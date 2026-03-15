import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** GET: 요금제 목록. PLATFORM_ADMIN */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const list = await prisma.pricingPlan.findMany({
    orderBy: { code: "asc" },
    include: { planFeatures: { include: { feature: { select: { code: true, name: true } } } } },
  });
  return NextResponse.json(list);
}

/** POST: 요금제 생성. PLATFORM_ADMIN */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: {
    code?: string;
    name?: string;
    description?: string;
    planType?: string;
    billingType?: string;
    price?: number;
    currency?: string;
    isActive?: boolean;
    validDays?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const planType = typeof body?.planType === "string" ? body.planType : "FEATURE";
  const billingType = typeof body?.billingType === "string" ? body.billingType : "ONE_TIME";
  if (!code || !name) {
    return NextResponse.json({ error: "code, name이 필요합니다." }, { status: 400 });
  }
  const price = typeof body?.price === "number" ? body.price : 0;
  const currency = typeof body?.currency === "string" ? body.currency : "KRW";
  const isActive = typeof body?.isActive === "boolean" ? body.isActive : true;
  const validDays = typeof body?.validDays === "number" ? body.validDays : null;
  const description = typeof body?.description === "string" ? body.description.trim() || null : null;
  try {
    const plan = await prisma.pricingPlan.create({
      data: { code, name, description, planType, billingType, price, currency, isActive, validDays },
    });
    return NextResponse.json(plan);
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "이미 존재하는 code입니다." }, { status: 400 });
    throw e;
  }
}
