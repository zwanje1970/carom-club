import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * POST /api/push/subscribe
 * body: { endpoint: string, p256dh: string, auth: string }
 * 로그인 사용자의 Push 구독 저장. 동일 endpoint면 업데이트.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { endpoint?: string; p256dh?: string; auth?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body?.p256dh === "string" ? body.p256dh.trim() : "";
  const auth = typeof body?.auth === "string" ? body.auth.trim() : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "endpoint, p256dh, auth가 필요합니다." },
      { status: 400 }
    );
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId: session.id, endpoint },
    },
    create: {
      userId: session.id,
      endpoint,
      p256dh,
      auth,
      isActive: true,
    },
    update: {
      p256dh,
      auth,
      isActive: true,
    },
  });

  return NextResponse.json({ ok: true });
}
