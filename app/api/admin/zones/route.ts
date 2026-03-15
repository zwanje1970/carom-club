import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 권역 목록 (대회에 권역 연결할 때 드롭다운용). 로그인 사용자. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const list = await prisma.zone.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, sortOrder: true },
  });
  return NextResponse.json(list);
}
