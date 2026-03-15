import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: 조직의 구독 목록. PLATFORM_ADMIN */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const list = await prisma.organizationPlanSubscription.findMany({
    where: { organizationId: id },
    orderBy: { startedAt: "desc" },
    include: { plan: { select: { code: true, name: true } } },
  });
  return NextResponse.json(list);
}

/** POST: 수동 부여/테스트용 구독. body: planId, expiresAt?, sourceType?, notes?. PLATFORM_ADMIN */
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
  let body: { planId?: string; expiresAt?: string; sourceType?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const planId = typeof body?.planId === "string" ? body.planId.trim() : "";
  if (!planId) return NextResponse.json({ error: "planId가 필요합니다." }, { status: 400 });
  const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
  if (!plan) return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
  const sourceType = typeof body?.sourceType === "string" ? body.sourceType : "MANUAL";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;
  let expiresAt: Date | null = null;
  if (typeof body?.expiresAt === "string" && body.expiresAt) {
    const d = new Date(body.expiresAt);
    if (!isNaN(d.getTime())) expiresAt = d;
  }
  if (!expiresAt && plan.validDays) {
    const d = new Date();
    d.setDate(d.getDate() + plan.validDays);
    expiresAt = d;
  }
  const sub = await prisma.organizationPlanSubscription.create({
    data: {
      organizationId: id,
      planId,
      status: "ACTIVE",
      sourceType,
      grantedByUserId: session.id,
      notes,
      expiresAt,
    },
    include: { plan: true },
  });
  return NextResponse.json(sub);
}
