import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 커뮤니티 게시판 목록 (slug, name, sortOrder) */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const boards = await prisma.communityBoard.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    /** 목록 탭용 — description 등 큰 필드 제외 */
    select: { id: true, slug: true, name: true, sortOrder: true },
  });
  const res = NextResponse.json(boards);
  res.headers.set("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res;
}
