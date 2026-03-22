import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { computeSettlementTotals } from "@/lib/tournament-settlement";
import { canAccessClientDashboard } from "@/types/auth";

/** 대회 정산 목록 + 기간 필터 (KST 날짜 문자열 from/to) */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return NextResponse.json({ error: "선택된 운영 조직이 없습니다." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const to = toStr ? new Date(`${toStr}T23:59:59.999+09:00`) : new Date();
  const from = fromStr
    ? new Date(`${fromStr}T00:00:00+09:00`)
    : new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "from/to 날짜 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const rows = await prisma.tournament.findMany({
    where: {
      organizationId: orgId,
      startAt: { gte: from, lte: to },
    },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      name: true,
      startAt: true,
      endAt: true,
      status: true,
      settlement: {
        select: {
          id: true,
          status: true,
          memo: true,
          lines: { select: { flow: true, amountKrw: true } },
        },
      },
    },
  });

  const tournaments = rows.map((t) => {
    const lines = t.settlement?.lines ?? [];
    const totals = computeSettlementTotals(lines);
    return {
      id: t.id,
      name: t.name,
      startAt: t.startAt,
      endAt: t.endAt,
      status: t.status,
      settlementStatus: t.settlement?.status ?? null,
      settlementId: t.settlement?.id ?? null,
      memo: t.settlement?.memo ?? null,
      income: totals.income,
      expense: totals.expense,
      net: totals.net,
    };
  });

  return NextResponse.json({ from: from.toISOString(), to: to.toISOString(), tournaments });
}
