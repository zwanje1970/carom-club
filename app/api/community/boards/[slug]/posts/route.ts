import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canWriteNotice, isCommunityModerator } from "@/lib/community-roles";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import { awardPostCreated } from "@/lib/community-score-service";
import { getLevelFromScore } from "@/lib/community-level";
import { ensureDefaultCommunityBoards } from "@/lib/community-ensure-boards";

/** 게시판별 글 목록. 텍스트 중심. 숨김 글은 관리자만 노출 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const popularRaw = searchParams.get("popular");
  const popular =
    popularRaw === "today" || popularRaw === "weekly" || popularRaw === "liked" || popularRaw === "comments"
      ? popularRaw
      : null;
  const sort = searchParams.get("sort") === "likes" ? "likes" : "latest";
  const statusFilter = searchParams.get("status") as string | null; // trouble 전용: all | open | solved
  const q = searchParams.get("q")?.trim() || "";
  const page = Math.max(0, Number(searchParams.get("page")) || 0);
  const take = Math.min(Number(searchParams.get("take")) || 20, 50);
  const session = await getSession();
  if (slug === "trouble" && !session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const showHidden = isCommunityModerator(session);

  let board = await prisma.communityBoard.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  });
  if (!board) {
    await ensureDefaultCommunityBoards();
    board = await prisma.communityBoard.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
  }
  if (!board) {
    return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const popularDateWhere =
    popular === "today"
      ? { createdAt: { gte: todayStart } }
      : popular === "weekly"
        ? { createdAt: { gte: weekStart } }
        : {};

  const where = {
    boardId: board.id,
    ...(showHidden ? {} : { isHidden: false }),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { content: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(slug === "trouble" && statusFilter === "open" ? { isSolved: false } : {}),
    ...(slug === "trouble" && statusFilter === "solved" ? { isSolved: true } : {}),
    ...popularDateWhere,
  };

  const listSelect = {
    id: true,
    title: true,
    thumbnailUrl: true,
    viewCount: true,
    isPinned: true,
    isSolved: true,
    createdAt: true,
    author: { select: { name: true } },
    _count: { select: { likes: true, comments: true } },
  } as const;

  /** Prisma findMany orderBy — `@prisma/client`의 Prisma 네임스페이스와 커스텀 generate 경로 불일치 시 CI 타입 오류 방지 */
  const listOrderBy =
    popular === "liked"
      ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
      : popular === "comments"
        ? [{ comments: { _count: "desc" as const } }, { createdAt: "desc" as const }]
        : popular === "today" || popular === "weekly"
          ? [{ viewCount: "desc" as const }, { createdAt: "desc" as const }]
          : sort === "likes"
            ? [{ likes: { _count: "desc" as const } }, { createdAt: "desc" as const }]
            : { createdAt: "desc" as const };

  const [pinned, list] = await Promise.all([
    slug === "notice"
      ? prisma.communityPost.findMany({
          where: { ...where, isPinned: true },
          orderBy: { createdAt: "desc" },
          select: listSelect,
        })
      : [],
    prisma.communityPost.findMany({
      where: slug === "notice" ? { ...where, isPinned: false } : where,
      orderBy: listOrderBy,
      skip: page * take,
      take,
      select: listSelect,
    }),
  ]);

  const format = (p: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
    viewCount: number;
    isPinned: boolean;
    isSolved: boolean | null;
    createdAt: Date;
    author: { name: string };
    _count: { likes: number; comments: number };
  }) => ({
    id: p.id,
    title: p.title,
    thumbnailUrl: p.thumbnailUrl ?? null,
    authorName: p.author.name,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    viewCount: p.viewCount,
    isPinned: p.isPinned,
    isSolved: p.isSolved ?? false,
    createdAt: p.createdAt.toISOString(),
  });

  return NextResponse.json({
    board: { id: board.id, slug: board.slug, name: board.name },
    pinned: pinned.map(format),
    posts: list.map(format),
    hasMore: list.length === take,
  });
}

/** 게시글 작성. 공지사항(slug=notice)은 관리자만 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { slug } = await params;

  let board = await prisma.communityBoard.findUnique({
    where: { slug },
    select: { id: true, slug: true },
  });
  if (!board) {
    await ensureDefaultCommunityBoards();
    board = await prisma.communityBoard.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });
  }
  if (!board) {
    return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  }
  if (board.slug === "notice" && !canWriteNotice(session)) {
    return NextResponse.json({ error: "공지사항은 관리자만 작성할 수 있습니다." }, { status: 403 });
  }
  const writeEnabled = await isFeatureEnabled("community_write_enabled");
  if (!writeEnabled) {
    return NextResponse.json({ error: "현재 커뮤니티 글쓰기가 중단되었습니다." }, { status: 503 });
  }
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { communityScore: true },
  });
  const level = user ? getLevelFromScore(user.communityScore) : 1;
  if (level < 1) {
    return NextResponse.json({ error: "게시글 작성 권한이 없습니다. (레벨 1 이상 필요)" }, { status: 403 });
  }

  let body: { title: string; content: string; imageUrls?: string[]; isPinned?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });

  const isPinned = board.slug === "notice" && canWriteNotice(session) && Boolean(body.isPinned);
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];

  const post = await prisma.communityPost.create({
    data: {
      boardId: board.id,
      authorId: session.id,
      title,
      content,
      imageUrls: imageUrls.length ? JSON.stringify(imageUrls) : null,
      isPinned,
    },
  });
  if (board.slug !== "notice") {
    try {
      await awardPostCreated(session.id, post.id);
    } catch (_) {
      // 점수 반영 실패해도 글 작성은 유지
    }
  }
  return NextResponse.json({ id: post.id, createdAt: post.createdAt.toISOString() });
}
