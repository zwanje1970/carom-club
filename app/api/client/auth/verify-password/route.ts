import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getUserById } from "../../../../../lib/platform-api";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password.trim() : "";
  if (!password) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }
  if (user.password.trim() !== password) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
