import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CLIENT_ORG_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;

/** GET: 회비 설정 + 입금 목록 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const org = await prisma.organization.findFirst({
    where: { id, type: { in: [...CLIENT_ORG_TYPES] } },
  });
  if (!org) {
    return NextResponse.json({ error: "클라이언트를 찾을 수 없습니다." }, { status: 404 });
  }
  const [feeSetting, payments] = await Promise.all([
    prisma.organizationFeeSetting.findUnique({ where: { organizationId: id } }),
    prisma.organizationFeePayment.findMany({
      where: { organizationId: id },
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
  ]);
  return NextResponse.json({
    feeSetting: feeSetting
      ? {
          id: feeSetting.id,
          feeType: feeSetting.feeType,
          amountInWon: feeSetting.amountInWon,
        }
      : null,
    payments: payments.map((p) => ({
      id: p.id,
      amountInWon: p.amountInWon,
      paidAt: p.paidAt.toISOString(),
      period: p.period,
      memo: p.memo,
    })),
  });
}

/** PATCH: 회비 유형(월회비/연회비) 및 권장 금액 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await params;
  const org = await prisma.organization.findFirst({
    where: { id, type: { in: [...CLIENT_ORG_TYPES] } },
  });
  if (!org) {
    return NextResponse.json({ error: "클라이언트를 찾을 수 없습니다." }, { status: 404 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const { feeType, amountInWon } = body as {
      feeType?: "MONTHLY" | "ANNUAL";
      amountInWon?: number | null;
    };
    if (feeType !== "MONTHLY" && feeType !== "ANNUAL") {
      return NextResponse.json({ error: "feeType은 MONTHLY 또는 ANNUAL이어야 합니다." }, { status: 400 });
    }
    await prisma.organizationFeeSetting.upsert({
      where: { organizationId: id },
      create: {
        organizationId: id,
        feeType,
        amountInWon: amountInWon ?? null,
      },
      update: {
        feeType,
        amountInWon: amountInWon === undefined ? undefined : amountInWon ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/organizations/fee] PATCH error:", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
