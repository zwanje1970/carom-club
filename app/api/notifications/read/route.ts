import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** POST: 알림 읽음 처리 (지정 ID 또는 전체) */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }
  try {
    const body = await req.json().catch(() => ({}));
    const { notificationIds } = body as { notificationIds?: string[] };
    if (notificationIds && Array.isArray(notificationIds) && notificationIds.length > 0) {
      await prisma.notification.updateMany({
        where: { id: { in: notificationIds }, userId: session.id },
        data: { readAt: new Date() },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId: session.id, readAt: null },
        data: { readAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[notifications/read]", e);
    return NextResponse.json({ error: "처리 실패" }, { status: 500 });
  }
}
