/**
 * 게시글 상세·댓글·난구 해법 — RSC/API 공용 (직접 DB).
 */
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isCommunityAdmin, isCommunityModerator } from "@/lib/community-roles";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import { parseTroubleBallPlacementJson } from "@/lib/trouble-ball-placement";
import type { SessionUser } from "@/types/auth";

export type CommunityPostDetailJson = Record<string, unknown> & {
  id: string;
  boardSlug: string;
  boardName: string;
  isHidden?: boolean;
  hiddenMessage?: string;
};

export type LoadCommunityPostDetailResult =
  | { ok: true; post: CommunityPostDetailJson }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "no_db" }
  | { ok: false; reason: "trouble_requires_login" };

export type CommunityPostPreviewJson = {
  id: string;
  boardSlug: string;
  boardName: string;
  title: string;
  content: string;
  imageUrls: string[];
  createdAt: string;
  isHidden?: boolean;
  hiddenMessage?: string;
};

function buildCommentsTree(
  comments: {
    id: string;
    parentId: string | null;
    authorId: string;
    content: string;
    isHidden: boolean;
    createdAt: Date;
    author: { name: string };
    _count: { likes: number };
  }[],
  canSeeHidden: boolean,
  userId: string | undefined,
  likedIds: Set<string>
) {
  const mapOne = (c: (typeof comments)[0]) => ({
    id: c.id,
    parentId: c.parentId,
    authorId: c.authorId,
    authorName: c.author.name,
    content: c.isHidden && !canSeeHidden ? "관리자에 의해 숨김 처리된 내용입니다." : c.content,
    isHidden: c.isHidden,
    likeCount: c._count.likes,
    createdAt: c.createdAt.toISOString(),
    isAuthor: userId === c.authorId,
    liked: likedIds.has(c.id),
  });

  const byParent = new Map<string | null, ReturnType<typeof mapOne>[]>();
  byParent.set(null, []);
  comments.forEach((c) => {
    const item = mapOne(c);
    const key = c.parentId ?? null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(item);
  });
  const topLevel = byParent.get(null) ?? [];
  return topLevel.map((item) => ({
    ...item,
    // 성능: 댓글 초기 응답은 1단계 답글까지만 구성한다.
    replies: byParent.get(item.id) ?? [],
  }));
}

/** GET /api/community/posts/[id]/comments 와 동일 트리 */
export async function getCommunityPostCommentsTree(postId: string, session: SessionUser | null) {
  if (!isDatabaseConfigured()) return [];
  const canSeeHidden = isCommunityModerator(session);

  const topLevelRows = await prisma.communityComment.findMany({
    where: { postId, parentId: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      parentId: true,
      authorId: true,
      content: true,
      isHidden: true,
      createdAt: true,
      author: { select: { name: true } },
      _count: { select: { likes: true } },
    },
  });
  const topLevelIds = topLevelRows.map((c) => c.id);
  const replyRows =
    topLevelIds.length > 0
      ? await prisma.communityComment.findMany({
          where: { postId, parentId: { in: topLevelIds } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            parentId: true,
            authorId: true,
            content: true,
            isHidden: true,
            createdAt: true,
            author: { select: { name: true } },
            _count: { select: { likes: true } },
          },
        })
      : [];
  const comments = [...topLevelRows, ...replyRows];

  const userId = session?.id;
  // 성능: 상세 초기 댓글 로딩에서는 사용자별 댓글 좋아요 상태를 조회하지 않는다.
  const likedIds = new Set<string>();

  return buildCommentsTree(comments, canSeeHidden, userId, likedIds);
}

/** 상세 첫 화면용 본문 프리뷰: 댓글/조회수/추천 상태 없이 제목·본문만 먼저 */
export async function loadCommunityPostPreview(
  id: string
): Promise<
  | { ok: true; post: CommunityPostPreviewJson }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "no_db" }
> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no_db" };

  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrls: true,
      isHidden: true,
      createdAt: true,
      board: { select: { slug: true, name: true } },
      author: { select: { name: true } },
    },
  });
  if (!post) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    post: {
      id: post.id,
      boardSlug: post.board.slug,
      boardName: post.board.name,
      title: post.title,
      content: post.content,
      imageUrls: post.imageUrls ? (JSON.parse(post.imageUrls) as string[]) : [],
      createdAt: post.createdAt.toISOString(),
      isHidden: post.isHidden,
      hiddenMessage: post.isHidden ? "관리자에 의해 숨김 처리된 내용입니다." : undefined,
    },
  };
}

/** GET /api/community/posts/[id] 와 동일 JSON */
export async function loadCommunityPostDetail(
  id: string,
  session: SessionUser | null
): Promise<LoadCommunityPostDetailResult> {
  if (!isDatabaseConfigured()) return { ok: false, reason: "no_db" };

  const canSeeHidden = isCommunityModerator(session);

  const post = await prisma.communityPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrls: true,
      isHidden: true,
      createdAt: true,
      board: { select: { slug: true, name: true } },
    },
  });
  if (!post) return { ok: false, reason: "not_found" };
  if (post.board.slug === "trouble" && !session) {
    return { ok: false, reason: "trouble_requires_login" };
  }
  if (post.isHidden && !canSeeHidden) {
    return {
      ok: true,
      post: {
        id: post.id,
        boardSlug: post.board.slug,
        boardName: post.board.name,
        isHidden: true,
        hiddenMessage: "관리자에 의해 숨김 처리된 내용입니다.",
      },
    };
  }
  const imageUrls = post.imageUrls ? (JSON.parse(post.imageUrls) as string[]) : [];
  const payload: CommunityPostDetailJson = {
    id: post.id,
    boardSlug: post.board.slug,
    boardName: post.board.name,
    title: post.title,
    content: post.content,
    imageUrls,
    isHidden: post.isHidden,
    createdAt: post.createdAt.toISOString(),
  };
  return { ok: true, post: payload };
}

export type TroubleSolutionListItem = {
  id: string;
  title: string | null;
  content: string;
  solutionImageUrl: string | null;
  solutionData: Record<string, unknown> | null;
  goodCount: number;
  badCount: number;
  isAccepted: boolean;
  createdAt: string;
  authorName: string;
  authorId: string;
  myVote: string | null;
};

/** GET /api/community/trouble/[postId]/solutions 와 동일 (비로그인 시 빈 배열) */
export async function getTroubleShotSolutionsForPost(
  postId: string,
  session: SessionUser | null
): Promise<TroubleSolutionListItem[]> {
  if (!isDatabaseConfigured() || !session) return [];

  const troubleShot = await prisma.troubleShotPost.findUnique({
    where: { postId },
    select: { id: true, acceptedSolutionId: true },
  });
  if (!troubleShot) return [];

  const solutions = await prisma.troubleShotSolution.findMany({
    where: { troubleShotPostId: troubleShot.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      content: true,
      solutionImageUrl: true,
      solutionDataJson: true,
      goodCount: true,
      badCount: true,
      isAccepted: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      votes: {
        where: { userId: session.id },
        select: { vote: true },
      },
    },
  });

  const acceptedId = troubleShot.acceptedSolutionId ?? undefined;
  const sorted = [...solutions].sort((a, b) => {
    const aAccepted = a.id === acceptedId ? 1 : 0;
    const bAccepted = b.id === acceptedId ? 1 : 0;
    if (bAccepted !== aAccepted) return bAccepted - aAccepted;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted.map((s) => {
    const votes = Array.isArray(s.votes) ? s.votes : [];
    let solutionData: Record<string, unknown> | null = null;
    if (s.solutionDataJson) {
      try {
        solutionData = JSON.parse(s.solutionDataJson) as Record<string, unknown>;
      } catch {
        solutionData = null;
      }
    }
    return {
      id: s.id,
      title: s.title,
      content: s.content,
      solutionImageUrl: s.solutionImageUrl,
      solutionData,
      goodCount: s.goodCount ?? 0,
      badCount: s.badCount ?? 0,
      isAccepted: s.id === acceptedId,
      createdAt: s.createdAt.toISOString(),
      authorId: s.author.id,
      authorName: s.author.name,
      myVote: votes.length ? (votes[0] as { vote: string }).vote : null,
    };
  });
}
