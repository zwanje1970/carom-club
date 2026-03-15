import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/push/unsubscribe
 * body: { endpoint?: string } — 없으면 해당 사용자 모든 구독 비활성화
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : null;

  if (endpoint) {
    await prisma.pushSubscription.updateMany({
      where: { userId: session.id, endpoint },
      data: { isActive: false },
    });
  } else {
    await prisma.pushSubscription.updateMany({
      where: { userId: session.id },
      data: { isActive: false },
    });
  }

  return NextResponse.json({ ok: true });
}
