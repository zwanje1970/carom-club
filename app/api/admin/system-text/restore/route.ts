import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

/** 이력 버전으로 문구 복원 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  let body: { historyId: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const hist = await prisma.systemTextHistory.findUnique({
    where: { id: body.historyId },
  });
  if (!hist) {
    return NextResponse.json({ error: "이력을 찾을 수 없습니다." }, { status: 404 });
  }
  const text = await prisma.systemText.findFirst({
    where: { id: hist.textId },
  });
  if (!text) {
    return NextResponse.json({ error: "대상 문구를 찾을 수 없습니다." }, { status: 404 });
  }
  const beforeValue = text.value ?? text.defaultValue;
  await prisma.systemText.update({
    where: { id: text.id },
    data: { value: hist.value },
  });
  await prisma.systemTextHistory.create({
    data: {
      textId: text.id,
      key: text.key,
      value: beforeValue ?? undefined,
      action: "restore",
      adminId: session.id,
    },
  });
  await createAdminLog({
    adminId: session.id,
    actionType: "restore",
    targetType: "system_text",
    targetId: text.id,
    beforeValue: beforeValue ?? undefined,
    afterValue: hist.value ?? undefined,
  });
  return NextResponse.json({ ok: true });
}
