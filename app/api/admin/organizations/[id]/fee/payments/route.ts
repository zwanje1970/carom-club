import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const CLIENT_ORG_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;

/** POST: 입금 내역 추가 */
export async function POST(
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
    const { amountInWon, paidAt, period, memo } = body as {
      amountInWon: number;
      paidAt: string;
      period: string;
      memo?: string | null;
    };
    if (typeof amountInWon !== "number" || amountInWon < 0) {
      return NextResponse.json({ error: "입금액(amountInWon)을 입력해 주세요." }, { status: 400 });
    }
    const paidAtDate = paidAt ? new Date(paidAt) : new Date();
    if (isNaN(paidAtDate.getTime())) {
      return NextResponse.json({ error: "입금일(paidAt) 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const periodStr = typeof period === "string" && period.trim() ? period.trim() : null;
    if (!periodStr) {
      return NextResponse.json({ error: "기간(period)을 입력해 주세요. 월회비: 2025-01, 연회비: 2025" }, { status: 400 });
    }
    await prisma.organizationFeePayment.create({
      data: {
        organizationId: id,
        amountInWon,
        paidAt: paidAtDate,
        period: periodStr,
        memo: memo?.trim() || null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/organizations/fee/payments] POST error:", e);
    return NextResponse.json({ error: "처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
