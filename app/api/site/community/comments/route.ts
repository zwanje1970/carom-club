import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { createComment, getUserById, listCommentsByPostId } from "../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postId = typeof url.searchParams.get("postId") === "string" ? url.searchParams.get("postId")!.trim() : "";
  if (!postId) {
    return NextResponse.json({ error: "postId가 필요합니다." }, { status: 400 });
  }
  const items = await listCommentsByPostId(postId);
  return NextResponse.json({ postId, items });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { postId?: unknown; content?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const postId = typeof body.postId === "string" ? body.postId : "";
  const content = typeof body.content === "string" ? body.content : "";

  const result = await createComment(postId, user.id, user.nickname, content);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, comment: result.comment });
}
