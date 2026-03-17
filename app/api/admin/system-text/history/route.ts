import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

/** 특정 문구(textId)의 변경 이력 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const textId = searchParams.get("textId");
  if (!textId) {
    return NextResponse.json({ error: "textId가 필요합니다." }, { status: 400 });
  }
  const list = await prisma.systemTextHistory.findMany({
    where: { textId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({
    items: list.map((h) => ({
      id: h.id,
      key: h.key,
      value: h.value,
      action: h.action,
      adminId: h.adminId,
      createdAt: h.createdAt.toISOString(),
    })),
  });
}
