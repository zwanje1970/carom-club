import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { createAdminLog } from "@/lib/admin-log";
import { isPlatformAdmin } from "@/types/auth";

const TYPES = ["bar", "popup", "emergency"] as const;

/** 목록 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const list = await prisma.notice.findMany({
    where: type && TYPES.includes(type as (typeof TYPES)[number]) ? { type } : undefined,
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({
    items: list.map((n) => ({
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
    })),
  });
}

/** 생성 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  let body: { type: string; title: string; content: string; linkUrl?: string; startAt?: string; endAt?: string; isActive?: boolean; showOnce?: boolean; showMobile?: boolean; showDesktop?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!TYPES.includes(body.type as (typeof TYPES)[number])) {
    return NextResponse.json({ error: "type은 bar, popup, emergency 중 하나여야 합니다." }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title이 필요합니다." }, { status: 400 });
  }
  const created = await prisma.notice.create({
    data: {
      type: body.type,
      title: body.title.trim(),
      content: body.content?.trim() ?? "",
      linkUrl: body.linkUrl?.trim() || null,
      startAt: body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt ? new Date(body.endAt) : null,
      isActive: body.isActive ?? true,
      showOnce: body.showOnce ?? false,
      showMobile: body.showMobile ?? true,
      showDesktop: body.showDesktop ?? true,
    },
  });
  await createAdminLog({
    adminId: session.id,
    actionType: "create",
    targetType: "notice",
    targetId: created.id,
    afterValue: JSON.stringify({ title: created.title, type: created.type }),
  });
  return NextResponse.json({
    id: created.id,
    type: created.type,
    title: created.title,
    createdAt: created.createdAt.toISOString(),
  });
}
