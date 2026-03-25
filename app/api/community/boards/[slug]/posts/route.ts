import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canWriteNotice, isCommunityModerator } from "@/lib/community-roles";
import { isFeatureEnabled } from "@/lib/site-feature-flags";
import { awardPostCreated } from "@/lib/community-score-service";
import { getLevelFromScore } from "@/lib/community-level";
import { ensureDefaultCommunityBoards } from "@/lib/community-ensure-boards";
import {
  BOARD_LIST_TAKE_DEFAULT,
  BOARD_LIST_TAKE_MAX,
  formatBoardListRow,
  queryBoardPostLists,
  type BoardListQueryParams,
} from "@/lib/community-board-list-query";
import { communityListPerfStart } from "@/lib/community-list-perf";
import { revalidateCommunityNoticePinned } from "@/lib/community-notice-pinned-revalidate";
import { revalidateCommunityHome } from "@/lib/community-home-revalidate";

/** 게시판별 글 목록. 본문·imageUrls·에디터 JSON 미포함. 검색은 제목만(본문 LIKE 제거로 부하 감소). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const endPerf = communityListPerfStart(`GET boards/[slug]/posts`);
  if (!isDatabaseConfigured()) {
    endPerf();
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const popularRaw = searchParams.get("popular");
  const popular =
    popularRaw === "today" || popularRaw === "weekly" || popularRaw === "liked" || popularRaw === "comments"
      ? popularRaw
      : null;
  const sortRaw = searchParams.get("sort");
  const sort =
    sortRaw === "likes" || sortRaw === "comments"
      ? sortRaw
      : "latest";
  const statusRaw = searchParams.get("status");
  const statusFilter: BoardListQueryParams["statusFilter"] =
    slug === "trouble" && (statusRaw === "open" || statusRaw === "solved") ? statusRaw : "all";
  const qRaw = searchParams.get("q")?.trim() || "";
  const page = Math.max(0, Number(searchParams.get("page")) || 0);
  const take = Math.min(Number(searchParams.get("take")) || BOARD_LIST_TAKE_DEFAULT, BOARD_LIST_TAKE_MAX);
  const cursorRaw = searchParams.get("cursor")?.trim() || null;
  const session = await getSession();
  if (slug === "trouble" && !session) {
    endPerf();
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
    endPerf();
    return NextResponse.json({ error: "게시판을 찾을 수 없습니다." }, { status: 404 });
  }

  const listParams: BoardListQueryParams = {
    boardId: board.id,
    slug,
    showHidden,
    qTitle: qRaw || undefined,
    statusFilter,
    popular,
    sort,
    page,
    take,
  };

  try {
    const { pinned, list, nextCursor } = await queryBoardPostLists(listParams, {
      cursor: cursorRaw,
    });
    endPerf();

    const res = NextResponse.json({
      board: { id: board.id, slug: board.slug, name: board.name },
      pinned: pinned.map(formatBoardListRow),
      posts: list.map(formatBoardListRow),
      hasMore: list.length === take,
      nextCursor,
    });
    /** 익명 목록은 짧게 캐시 (세션은 trouble 등에서만 변동) */
    if (slug !== "trouble" && !showHidden) {
      res.headers.set("Cache-Control", "public, s-maxage=15, stale-while-revalidate=60");
    }
    return res;
  } catch (e) {
    endPerf();
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
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
  if (board.slug === "notice") {
    revalidateCommunityNoticePinned(board.id);
  }
  revalidateCommunityHome();
  if (board.slug !== "notice") {
    try {
      await awardPostCreated(session.id, post.id);
    } catch (_) {
      // 점수 반영 실패해도 글 작성은 유지
    }
  }
  return NextResponse.json({ id: post.id, createdAt: post.createdAt.toISOString() });
}
