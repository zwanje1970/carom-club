import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

/** 단일 조회 (id = SystemText.id) */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { id } = await context.params;
  const row = await prisma.systemText.findUnique({
    where: { id },
  });
  if (!row) {
    return NextResponse.json({ error: "문구를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    key: row.key,
    group: row.group,
    label: row.label,
    description: row.description,
    value: row.value,
    defaultValue: row.defaultValue,
    isEnabled: row.isEnabled,
    updatedAt: row.updatedAt.toISOString(),
  });
}

/** 수정 / 비우기 / 기본값 복원 / 사용 ON·OFF */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { id } = await context.params;
  const row = await prisma.systemText.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "문구를 찾을 수 없습니다." }, { status: 404 });
  }
  let body: { value?: string | null; isEnabled?: boolean; action?: "clear" | "reset_default" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const updates: { value?: string | null; isEnabled?: boolean } = {};
  let actionType = "update";

  if (body.action === "clear") {
    updates.value = null;
    actionType = "clear";
  } else if (body.action === "reset_default") {
    updates.value = row.defaultValue;
    actionType = "reset_default";
  } else {
    if (body.value !== undefined) updates.value = body.value;
    if (body.isEnabled !== undefined) updates.isEnabled = body.isEnabled;
  }

  const beforeValue = row.value ?? row.defaultValue;
  const updated = await prisma.systemText.update({
    where: { id },
    data: updates,
  });
  const afterValue = updated.value ?? updated.defaultValue;

  await prisma.systemTextHistory.create({
    data: {
      textId: row.id,
      key: row.key,
      value: beforeValue,
      action: actionType,
      adminId: session.id,
    },
  });
  await createAdminLog({
    adminId: session.id,
    actionType,
    targetType: "system_text",
    targetId: row.id,
    beforeValue: beforeValue ?? undefined,
    afterValue: afterValue ?? undefined,
  });

  return NextResponse.json({
    id: updated.id,
    key: updated.key,
    value: updated.value,
    defaultValue: updated.defaultValue,
    isEnabled: updated.isEnabled,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
