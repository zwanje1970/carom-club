import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: 조직의 기능 접근 목록. PLATFORM_ADMIN */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const list = await prisma.organizationFeatureAccess.findMany({
    where: { organizationId: id },
    orderBy: { startedAt: "desc" },
    include: { feature: { select: { code: true, name: true } } },
  });
  return NextResponse.json(list);
}

/** POST: 수동 기능 부여. body: featureId, expiresAt?, notes?. PLATFORM_ADMIN */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "조직을 찾을 수 없습니다." }, { status: 404 });
  let body: { featureId?: string; featureCode?: string; expiresAt?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  let featureId = typeof body?.featureId === "string" ? body.featureId.trim() : "";
  if (!featureId && typeof body?.featureCode === "string") {
    const feature = await prisma.feature.findFirst({ where: { code: body.featureCode!.trim(), isActive: true } });
    if (feature) featureId = feature.id;
  }
  if (!featureId) return NextResponse.json({ error: "featureId 또는 featureCode가 필요합니다." }, { status: 400 });
  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature || !feature.isActive) return NextResponse.json({ error: "기능을 찾을 수 없습니다." }, { status: 404 });
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  let expiresAt: Date | null = null;
  if (typeof body?.expiresAt === "string" && body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (!isNaN(d.getTime())) expiresAt = d;
  }
  const acc = await prisma.organizationFeatureAccess.create({
    data: {
      organizationId: id,
      featureId,
      status: "ACTIVE",
      sourceType: "MANUAL",
      notes,
      expiresAt,
    },
    include: { feature: { select: { code: true, name: true } } },
  });
  return NextResponse.json(acc);
}
