/**
 * 게시글 상세·댓글·난구 해법 — RSC/API 공용 (직접 DB).
 */
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isCommunityAdmin, isCommunityModerator } from "@/lib/community-roles";
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

  const withReplies = (parentKey: string | null): ReturnType<typeof mapOne>[] => {
    const list = byParent.get(parentKey) ?? [];
    return list.map((item) => ({
      ...item,
      replies: withReplies(item.id),
    }));
  };

  return withReplies(null);
}

/** GET /api/community/posts/[id]/comments 와 동일 트리 */
export async function getCommunityPostCommentsTree(postId: string, session: SessionUser | null) {
  if (!isDatabaseConfigured()) return [];
  const canSeeHidden = isCommunityModerator(session);

  const comments = await prisma.communityComment.findMany({
    where: { postId },
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

  const userId = session?.id;
  const likedIds = userId
    ? new Set(
        (
          await prisma.communityCommentLike.findMany({
            where: { userId, commentId: { in: comments.map((c) => c.id) } },
            select: { commentId: true },
          })
        ).map((r) => r.commentId)
      )
    : new Set<string>();

  return buildCommentsTree(comments, canSeeHidden, userId, likedIds);
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
      boardId: true,
      authorId: true,
      title: true,
      content: true,
      imageUrls: true,
      isPinned: true,
      isHidden: true,
      isSolved: true,
      viewCount: true,
      createdAt: true,
      updatedAt: true,
      board: { select: { slug: true, name: true } },
      author: { select: { id: true, name: true } },
      _count: { select: { likes: true, comments: true } },
      troubleShot: {
        select: {
          layoutImageUrl: true,
          ballPlacementJson: true,
          difficulty: true,
          sourceNoteId: true,
          acceptedSolutionId: true,
        },
      },
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

  let liked = false;
  let bookmarked = false;
  if (session) {
    const [likeRow, bookmarkRow] = await Promise.all([
      prisma.communityPostLike.findUnique({
        where: { postId_userId: { postId: id, userId: session.id } },
      }),
      prisma.communityBookmark.findUnique({
        where: { userId_postId: { userId: session.id, postId: id } },
      }),
    ]);
    liked = !!likeRow;
    bookmarked = !!bookmarkRow;
  }

  const imageUrls = post.imageUrls ? (JSON.parse(post.imageUrls) as string[]) : [];
  const payload: CommunityPostDetailJson = {
    id: post.id,
    boardId: post.boardId,
    boardSlug: post.board.slug,
    boardName: post.board.name,
    authorId: post.authorId,
    authorName: post.author.name,
    title: post.title,
    content: post.content,
    imageUrls,
    isPinned: post.isPinned,
    isHidden: post.isHidden,
    isSolved: post.isSolved ?? false,
    viewCount: post.viewCount,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    isAuthor: session?.id === post.authorId,
    canEdit: session?.id === post.authorId || isCommunityAdmin(session),
    canDelete: session?.id === post.authorId || isCommunityAdmin(session),
    isLoggedIn: !!session,
    liked,
    bookmarked,
  };
  if (post.board.slug === "trouble" && post.troubleShot) {
    payload.troubleShot = {
      layoutImageUrl: post.troubleShot.layoutImageUrl,
      ballPlacement: parseTroubleBallPlacementJson(post.troubleShot.ballPlacementJson),
      difficulty: post.troubleShot.difficulty,
      sourceNoteId: post.troubleShot.sourceNoteId,
      acceptedSolutionId: post.troubleShot.acceptedSolutionId,
    };
  }
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
