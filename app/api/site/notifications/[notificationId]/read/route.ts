import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getUserById, markNotificationAsRead } from "../../../../../../lib/platform-api";

export const runtime = "nodejs";

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ notificationId: string }> }
) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { notificationId } = await context.params;
  if (!notificationId.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const updated = await markNotificationAsRead({
    userId: user.id,
    notificationId: notificationId.trim(),
  });
  if (!updated) {
    return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, notification: updated });
}
