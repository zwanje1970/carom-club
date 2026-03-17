import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

/** 관리자 활동 로그 목록 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ items: [] });
  }
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("targetType") ?? undefined;
  const take = Math.min(Number(searchParams.get("take")) || 100, 200);
  const list = await prisma.adminLog.findMany({
    where: targetType ? { targetType } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({
    items: list.map((l) => ({
      id: l.id,
      adminId: l.adminId,
      actionType: l.actionType,
      targetType: l.targetType,
      targetId: l.targetId,
      beforeValue: l.beforeValue,
      afterValue: l.afterValue,
      createdAt: l.createdAt.toISOString(),
    })),
  });
}
