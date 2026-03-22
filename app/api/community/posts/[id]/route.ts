import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isCommunityAdmin, isCommunityModerator } from "@/lib/community-roles";
import { parseTroubleBallPlacementJson } from "@/lib/trouble-ball-placement";
import { revalidateCommunityNoticePinned } from "@/lib/community-notice-pinned-revalidate";

/** 게시글 상세 조회. 조회수는 POST /view 에서만 증가 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { id } = await params;
  const session = await getSession();
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
  if (!post) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (post.board.slug === "trouble" && !session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (post.isHidden && !canSeeHidden) {
    return NextResponse.json({
      id: post.id,
      boardSlug: post.board.slug,
      boardName: post.board.name,
      isHidden: true,
      hiddenMessage: "관리자에 의해 숨김 처리된 내용입니다.",
    });
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
  const payload: Record<string, unknown> = {
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
  return NextResponse.json(payload);
}

/** 게시글 수정. 작성자 또는 관리자 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.communityPost.findUnique({
    where: { id },
    select: { authorId: true, boardId: true, board: { select: { slug: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (existing.authorId !== session.id && !isCommunityAdmin(session)) {
    return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 });
  }

  let body: { title?: string; content?: string; imageUrls?: string[]; isPinned?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data: { title?: string; content?: string; imageUrls?: string | null; isPinned?: boolean } = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.content !== undefined) data.content = body.content.trim();
  if (body.imageUrls !== undefined) data.imageUrls = Array.isArray(body.imageUrls) && body.imageUrls.length ? JSON.stringify(body.imageUrls) : null;
  if (existing.board.slug === "notice" && isCommunityAdmin(session) && body.isPinned !== undefined) data.isPinned = Boolean(body.isPinned);

  const updated = await prisma.communityPost.update({
    where: { id },
    data,
  });
  if (existing.board.slug === "notice") {
    revalidateCommunityNoticePinned(existing.boardId);
  }
  return NextResponse.json({ id: updated.id, updatedAt: updated.updatedAt.toISOString() });
}

/** 게시글 삭제. 작성자 또는 관리자 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id } = await params;

  const existing = await prisma.communityPost.findUnique({
    where: { id },
    select: { authorId: true, boardId: true, board: { select: { slug: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  }
  const isAuthor = existing.authorId === session.id;
  if (!isAuthor && !isCommunityAdmin(session)) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  await prisma.communityPost.delete({ where: { id } });
  if (existing.board.slug === "notice") {
    revalidateCommunityNoticePinned(existing.boardId);
  }
  return NextResponse.json({ ok: true });
}
