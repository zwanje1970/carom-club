import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

/** 전체 문구를 defaultValue로 초기화 */
export async function POST() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const rows = await prisma.systemText.findMany({
    select: { id: true, key: true, value: true, defaultValue: true },
  });
  let count = 0;
  for (const row of rows) {
    if (row.value !== null && row.value !== row.defaultValue) {
      await prisma.systemText.update({
        where: { id: row.id },
        data: { value: row.defaultValue },
      });
      await createAdminLog({
        adminId: session.id,
        actionType: "reset_default",
        targetType: "system_text",
        targetId: row.id,
        beforeValue: row.value,
        afterValue: row.defaultValue ?? null,
      });
      count++;
    }
  }
  return NextResponse.json({ ok: true, resetCount: count });
}
