import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

const TYPES = ["bar", "popup", "emergency"] as const;

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
  const n = await prisma.notice.findUnique({ where: { id } });
  if (!n) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    linkUrl: n.linkUrl,
    startAt: n.startAt?.toISOString() ?? null,
    endAt: n.endAt?.toISOString() ?? null,
    isActive: n.isActive,
    showOnce: n.showOnce,
    showMobile: n.showMobile,
    showDesktop: n.showDesktop,
    sortOrder: n.sortOrder,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  });
}

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
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  let body: { type?: string; title?: string; content?: string; linkUrl?: string; startAt?: string | null; endAt?: string | null; isActive?: boolean; showOnce?: boolean; showMobile?: boolean; showDesktop?: boolean; sortOrder?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (body.type !== undefined && TYPES.includes(body.type as (typeof TYPES)[number])) data.type = body.type;
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.content !== undefined) data.content = body.content.trim();
  if (body.linkUrl !== undefined) data.linkUrl = body.linkUrl?.trim() || null;
  if (body.startAt !== undefined) data.startAt = body.startAt ? new Date(body.startAt) : null;
  if (body.endAt !== undefined) data.endAt = body.endAt ? new Date(body.endAt) : null;
  if (body.isActive !== undefined) data.isActive = body.isActive;
  if (body.showOnce !== undefined) data.showOnce = body.showOnce;
  if (body.showMobile !== undefined) data.showMobile = body.showMobile;
  if (body.showDesktop !== undefined) data.showDesktop = body.showDesktop;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;
  const updated = await prisma.notice.update({
    where: { id },
    data,
  });
  await createAdminLog({
    adminId: session.id,
    actionType: "update",
    targetType: "notice",
    targetId: id,
    afterValue: JSON.stringify({ title: updated.title, type: updated.type }),
  });
  return NextResponse.json({
    id: updated.id,
    type: updated.type,
    title: updated.title,
    isActive: updated.isActive,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(
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
  const existing = await prisma.notice.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "공지를 찾을 수 없습니다." }, { status: 404 });
  await prisma.notice.delete({ where: { id } });
  await createAdminLog({
    adminId: session.id,
    actionType: "delete",
    targetType: "notice",
    targetId: id,
    beforeValue: JSON.stringify({ title: existing.title, type: existing.type }),
  });
  return NextResponse.json({ ok: true });
}
