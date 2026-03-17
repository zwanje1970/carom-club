import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 커뮤니티 게시판 목록 (slug, name, sortOrder) */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const boards = await prisma.communityBoard.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, description: true, sortOrder: true },
  });
  return NextResponse.json(boards);
}
