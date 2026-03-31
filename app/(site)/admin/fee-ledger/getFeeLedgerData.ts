import { prisma } from "@/lib/db";
import { normalizeSlugs } from "@/lib/normalize-slug";
import type { FeeLedgerRow, PaymentRecord, FeeLedgerData } from "./types";

const CLIENT_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;

function parsePeriod(period: string): { y: number; m: number } | null {
  const monthly = /^(\d{4})-(\d{1,2})$/.exec(period);
  if (monthly) return { y: parseInt(monthly[1], 10), m: parseInt(monthly[2], 10) };
  const annual = /^(\d{4})$/.exec(period);
  if (annual) return { y: parseInt(annual[1], 10), m: 12 };
  return null;
}

export async function getFeeLedgerData(): Promise<FeeLedgerData> {
  const orgs = await prisma.organization.findMany({
    where: { type: { in: [...CLIENT_TYPES] } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      adminRemarks: true,
      feeSetting: true,
      feePayments: { orderBy: { paidAt: "desc" }, take: 500 },
    },
  });

  const now = new Date();
  const currentY = now.getFullYear();
  const currentM = now.getMonth() + 1;
  const currentPeriod = `${currentY}-${String(currentM).padStart(2, "0")}`;

  const rows: (Omit<FeeLedgerRow, "slug"> & { slug: string | null })[] = [];
  const payments: PaymentRecord[] = [];
  let paidThisMonth = 0;
  let arrearsCount = 0;
  let totalAmount = 0;

  for (const org of orgs) {
    const feeType = org.feeSetting?.feeType ?? null;
    const amountInWon = org.feeSetting?.amountInWon ?? null;
    const payList = org.feePayments ?? [];

    const totalPaid = payList.reduce((s, p) => s + p.amountInWon, 0);
    totalAmount += totalPaid;

    const latest = payList[0] ?? null;
    const latestPeriod = latest?.period ?? null;
    const latestPaidAt = latest?.paidAt ? latest.paidAt.toISOString() : null;

    let thisMonthStatus: "납부완료" | "미납" | "해당없음" = "해당없음";
    let monthsArrears: number | null = null;

    if (feeType === "MONTHLY") {
      const hasThisMonth = payList.some((p) => p.period === currentPeriod);
      thisMonthStatus = hasThisMonth ? "납부완료" : "미납";
      if (hasThisMonth) paidThisMonth += 1;

      if (latestPeriod) {
        const p = parsePeriod(latestPeriod);
        if (p) {
          const diff = (currentY - p.y) * 12 + (currentM - p.m);
          monthsArrears = diff <= 0 ? 0 : diff;
          if (monthsArrears > 0) arrearsCount += 1;
        }
      } else {
        monthsArrears = null;
      }
    } else if (feeType === "ANNUAL") {
      const hasThisYear = payList.some((p) => p.period === String(currentY));
      thisMonthStatus = hasThisYear ? "납부완료" : "미납";
      if (hasThisYear) paidThisMonth += 1;

      if (latestPeriod) {
        const p = parsePeriod(latestPeriod);
        if (p && p.y < currentY) {
          monthsArrears = currentY - p.y;
          arrearsCount += 1;
        } else {
          monthsArrears = 0;
        }
      }
    }

    for (const p of payList) {
      payments.push({
        id: p.id,
        organizationId: org.id,
        organizationName: org.name,
        amountInWon: p.amountInWon,
        paidAt: p.paidAt.toISOString(),
        period: p.period,
        memo: p.memo,
      });
    }

    rows.push({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      feeType,
      amountInWon,
      latestPeriod,
      latestPaidAt,
      thisMonthStatus,
      monthsArrears,
      totalPaid,
      adminRemarks: org.adminRemarks,
    });
  }

  payments.sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime());

  return {
    rows: normalizeSlugs(rows),
    payments,
    summary: {
      totalOrgs: rows.length,
      paidThisMonth,
      arrearsCount,
      totalAmount,
    },
  };
}
