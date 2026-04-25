import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { checkNicknameAvailability } from "../../../../lib/platform-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nickname = url.searchParams.get("nickname") ?? "";

  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  const excludeUserId = session?.userId;

  const result = await checkNicknameAvailability(nickname, excludeUserId);
  if (!result.ok) {
    return NextResponse.json({ available: false, error: result.error });
  }
  return NextResponse.json({ available: true, nickname: result.nickname });
}
