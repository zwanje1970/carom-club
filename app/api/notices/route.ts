import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 공개: 현재 노출할 공지 목록. 우선순위 emergency → popup → bar */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ bar: [], popup: [], emergency: [] });
  }
  const { searchParams } = new URL(request.url);
  const device = searchParams.get("device") ?? "desktop"; // desktop | mobile
  const now = new Date();
  const isMobile = device === "mobile";

  const where = {
    isActive: true,
    OR: [
      { startAt: null, endAt: null },
      { startAt: { lte: now }, endAt: null },
      { startAt: null, endAt: { gte: now } },
      { startAt: { lte: now }, endAt: { gte: now } },
    ],
    ...(isMobile ? { showMobile: true } : { showDesktop: true }),
  };

  const [emergency, popup, bar] = await Promise.all([
    prisma.notice.findMany({
      where: { ...where, type: "emergency" },
      orderBy: { sortOrder: "asc" },
      take: 5,
      select: { id: true, type: true, title: true, content: true, linkUrl: true, showOnce: true },
    }),
    prisma.notice.findMany({
      where: { ...where, type: "popup" },
      orderBy: { sortOrder: "asc" },
      take: 5,
      select: { id: true, type: true, title: true, content: true, linkUrl: true, showOnce: true },
    }),
    prisma.notice.findMany({
      where: { ...where, type: "bar" },
      orderBy: { sortOrder: "asc" },
      take: 10,
      select: { id: true, type: true, title: true, content: true, linkUrl: true },
    }),
  ]);

  return NextResponse.json({
    emergency: emergency.map((n) => ({ id: n.id, type: n.type, title: n.title, content: n.content, linkUrl: n.linkUrl, showOnce: n.showOnce })),
    popup: popup.map((n) => ({ id: n.id, type: n.type, title: n.title, content: n.content, linkUrl: n.linkUrl, showOnce: n.showOnce })),
    bar: bar.map((n) => ({ id: n.id, type: n.type, title: n.title, content: n.content, linkUrl: n.linkUrl })),
  });
}
