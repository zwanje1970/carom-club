import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** PATCH: 요금제 수정. PLATFORM_ADMIN */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
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
  const existing = await prisma.pricingPlan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "요금제를 찾을 수 없습니다." }, { status: 404 });
  const data: Record<string, unknown> = {};
  if (typeof body?.code === "string" && body.code.trim()) data.code = body.code.trim();
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body?.description !== undefined) data.description = typeof body.description === "string" ? body.description.trim() || null : null;
  if (typeof body?.planType === "string") data.planType = body.planType;
  if (typeof body?.billingType === "string") data.billingType = body.billingType;
  if (typeof body?.price === "number") data.price = body.price;
  if (typeof body?.currency === "string") data.currency = body.currency;
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (body?.validDays !== undefined) data.validDays = typeof body.validDays === "number" ? body.validDays : null;
  try {
    const plan = await prisma.pricingPlan.update({
      where: { id },
      data,
    });
    return NextResponse.json(plan);
  } catch (e) {
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "이미 존재하는 code입니다." }, { status: 400 });
    throw e;
  }
}
