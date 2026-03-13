import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 로그인 사용자의 읽지 않은 알림 목록 (최대 10건) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ notifications: [] });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ notifications: [] });
  }
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.id, readAt: null },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, message: true, createdAt: true },
    });
    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        message: n.message,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
