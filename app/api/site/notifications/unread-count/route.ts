import { NextResponse } from "next/server";
import { getSiteUnreadNotificationCount } from "../../../../../lib/server/site-unread-notification-count";

export const runtime = "nodejs";

/** 공개 사이트: 미읽음 알림 개수만 JSON 숫자로 반환(목록·내용 없음) */
export async function GET() {
  const count = await getSiteUnreadNotificationCount();
  return NextResponse.json(count);
}
