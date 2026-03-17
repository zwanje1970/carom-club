import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { listSystemTexts } from "@/lib/system-text";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

/** 목록 (그룹/검색) */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const group = searchParams.get("group") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const items = await listSystemTexts({ group, search });
  return NextResponse.json({
    items: items.map((r) => ({
      id: r.id,
      key: r.key,
      group: r.group,
      label: r.label,
      description: r.description,
      value: r.value,
      defaultValue: r.defaultValue,
      isEnabled: r.isEnabled,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
}

/** 문구 일괄 치환 (find -> replace in value) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  let body: { find: string; replace: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const { find, replace } = body;
  if (typeof find !== "string" || find.trim() === "") {
    return NextResponse.json({ error: "find 문자열이 필요합니다." }, { status: 400 });
  }
  const rows = await prisma.systemText.findMany({
    where: { OR: [{ value: { contains: find } }, { defaultValue: { contains: find } }] },
    select: { id: true, key: true, value: true },
  });
  let count = 0;
  for (const row of rows) {
    const newValue = (row.value ?? "").replace(new RegExp(escapeRe(find), "g"), replace);
    if (newValue !== (row.value ?? "")) {
      await prisma.systemText.update({
        where: { id: row.id },
        data: { value: newValue },
      });
      await createAdminLog({
        adminId: session.id,
        actionType: "bulk_replace",
        targetType: "system_text",
        targetId: row.id,
        beforeValue: row.value ?? undefined,
        afterValue: newValue,
      });
      count++;
    }
  }
  return NextResponse.json({ ok: true, updatedCount: count });
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
