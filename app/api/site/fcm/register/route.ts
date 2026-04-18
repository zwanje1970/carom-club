import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getUserById, upsertFcmDeviceTokenForUser } from "../../../../../lib/server/dev-store";

export const runtime = "nodejs";

/**
 * 웹뷰 앱 등: 로그인 세션 기준 FCM 디바이스 토큰 등록(사용자당 여러 토큰 가능).
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  let body: { token?: unknown; platform?: unknown };
  try {
    body = (await request.json()) as { token?: unknown; platform?: unknown };
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "token이 필요합니다." }, { status: 400 });
  }

  const platformRaw = body.platform;
  const platform =
    typeof platformRaw === "string" && platformRaw.trim() ? platformRaw.trim() : "android";

  await upsertFcmDeviceTokenForUser({
    userId: user.id,
    token,
    platform,
  });

  return NextResponse.json({ ok: true });
}
