import { NextResponse } from "next/server";
import { sendVenueReminders } from "@/lib/push/venueReminder";

/**
 * GET /api/cron/venue-reminder
 * 대회 시작 12시간 전 경기장 안내 푸시 발송.
 * Vercel Cron: CRON_SECRET 헤더로 호출 권한 확인.
 */
export async function GET(request: Request) {
  const secret = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? request.headers.get("x-cron-secret") ?? "";
  const expected = process.env.CRON_SECRET;
  if (expected && secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendVenueReminders();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("venue-reminder error", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
