import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isCommunityAdmin } from "@/lib/community-roles";
import { loadCommunityPostDetail } from "@/lib/community-post-detail-server";
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
  const result = await loadCommunityPostDetail(id, session);
  if (!result.ok) {
    if (result.reason === "no_db") {
      return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
    }
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
    }
    if (result.reason === "trouble_requires_login") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
  }
  return NextResponse.json(result.post);
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
