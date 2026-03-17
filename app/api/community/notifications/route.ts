import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 읽지 않은 알림 개수 (헤더 종 아이콘용) */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ unreadCount: 0, list: [] });
  }

  const { searchParams } = new URL(request.url);
  const listOnly = searchParams.get("list") === "1";

  try {
    const unreadCount = await prisma.communityNotification.count({
      where: { userId: session.id, readAt: null },
    });

    if (!listOnly) {
      return NextResponse.json({ unreadCount });
    }

    const list = await prisma.communityNotification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        type: true,
        postId: true,
        commentId: true,
        relatedUserId: true,
        readAt: true,
        createdAt: true,
        relatedUser: { select: { name: true } },
      },
    });

    return NextResponse.json({
      unreadCount,
      list: list.map((n) => ({
        id: n.id,
        type: n.type,
        postId: n.postId,
        commentId: n.commentId,
        relatedUserName: n.relatedUser?.name ?? null,
        readAt: n.readAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("P2021")) {
      return NextResponse.json(
        { unreadCount: 0, list: [], error: "CommunityNotification 테이블이 없습니다. npx prisma migrate deploy 를 실행하세요." },
        { status: 200 }
      );
    }
    throw e;
  }
}
