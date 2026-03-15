import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: 요금제에 포함된 기능 목록. PLATFORM_ADMIN */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const plan = await prisma.pricingPlan.findUnique({
    where: { id },
    include: { planFeatures: { include: { feature: true } } },
  });
  if (!plan) return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json(plan.planFeatures);
}

/** POST: 요금제에 기능 연결. body: { featureId }. PLATFORM_ADMIN */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const plan = await prisma.pricingPlan.findUnique({ where: { id } });
  if (!plan) return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
  let body: { featureId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const featureId = typeof body?.featureId === "string" ? body.featureId.trim() : "";
  if (!featureId) return NextResponse.json({ error: "featureId가 필요합니다." }, { status: 400 });
  const feature = await prisma.feature.findUnique({ where: { id: featureId } });
  if (!feature) return NextResponse.json({ error: "기능을 찾을 수 없습니다." }, { status: 404 });
  try {
    const pf = await prisma.planFeature.create({
      data: { planId: id, featureId },
      include: { feature: true },
    });
    return NextResponse.json(pf);
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "이미 연결된 기능입니다." }, { status: 400 });
    throw e;
  }
}
