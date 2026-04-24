import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  getCommunityPostById,
  getUserById,
  incrementCommunityPostViewCount,
  softDeleteCommunityPostById,
  updateCommunityPostById,
} from "../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const trimmed = typeof id === "string" ? id.trim() : "";
  if (!trimmed) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const before = await getCommunityPostById(trimmed);
  if (!before) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  await incrementCommunityPostViewCount(trimmed);
  const post = await getCommunityPostById(trimmed);
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({ post });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const postId = typeof id === "string" ? id.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  let body: { title?: unknown; content?: unknown; imageUrls?: unknown; imageSizeLevels?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";

  const result = await updateCommunityPostById(postId, user.id, {
    title,
    content,
    imageUrls: body.imageUrls,
    imageSizeLevels: body.imageSizeLevels,
  });
  if (!result.ok) {
    if (result.code === "NOT_FOUND") return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    if (result.code === "FORBIDDEN") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    if (result.code === "PERSIST_UNAVAILABLE") {
      return NextResponse.json(
        { error: "운영 저장소(Firestore)에 쓸 수 없습니다. Firebase 자격 증명을 확인해 주세요." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "제목과 내용을 입력해 주세요." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const postId = typeof id === "string" ? id.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const result = await softDeleteCommunityPostById(postId, user.id);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
    if (result.code === "PERSIST_UNAVAILABLE") {
      return NextResponse.json(
        { error: "운영 저장소(Firestore)에 쓸 수 없습니다. Firebase 자격 증명을 확인해 주세요." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
