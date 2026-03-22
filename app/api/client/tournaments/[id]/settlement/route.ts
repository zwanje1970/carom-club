import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  computeSettlementTotals,
  isSettlementCategory,
  isSettlementFlow,
} from "@/lib/tournament-settlement";
import { canAccessClientDashboard } from "@/types/auth";

type LineInput = {
  id?: string;
  category: string;
  flow: string;
  amountKrw: number;
  label?: string | null;
  note?: string | null;
  sortOrder?: number;
};

function validateLines(lines: unknown): LineInput[] | { error: string } {
  if (!Array.isArray(lines)) return { error: "lines 배열이 필요합니다." };
  const out: LineInput[] = [];
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i] as Record<string, unknown>;
    if (!row || typeof row !== "object") return { error: `lines[${i}] 형식 오류` };
    const cat = String(row.category ?? "");
    const flow = String(row.flow ?? "");
    if (!isSettlementCategory(cat)) return { error: `알 수 없는 category: ${cat}` };
    if (!isSettlementFlow(flow)) return { error: `flow는 INCOME 또는 EXPENSE여야 합니다.` };
    const amountKrw = Number(row.amountKrw);
    if (!Number.isFinite(amountKrw) || amountKrw < 0) {
      return { error: `lines[${i}].amountKrw는 0 이상 숫자여야 합니다.` };
    }
    out.push({
      category: cat,
      flow,
      amountKrw: Math.round(amountKrw),
      label: row.label != null ? String(row.label) : null,
      note: row.note != null ? String(row.note) : null,
      sortOrder: row.sortOrder != null ? Number(row.sortOrder) : i,
    });
  }
  return out;
}

/** GET: 대회 정산(없으면 null) + 요약 금액 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const settlement = await prisma.tournamentSettlement.findUnique({
    where: { tournamentId },
    include: { lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });

  const totals = settlement
    ? computeSettlementTotals(settlement.lines)
    : { income: 0, expense: 0, net: 0 };

  return NextResponse.json({
    tournament: gate.tournament,
    settlement,
    totals,
  });
}

/** PUT: 정산 생성/갱신(라인 전체 교체). LOCKED 상태에서는 잠금 해제(DRAFT)만 허용 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = (await request.json()) as {
    memo?: string | null;
    status?: string;
    lines?: unknown;
  };

  const existing = await prisma.tournamentSettlement.findUnique({
    where: { tournamentId },
    include: { lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
  });

  if (existing?.status === "LOCKED") {
    const wantDraft = body.status === "DRAFT";
    if (wantDraft && body.lines === undefined) {
      await prisma.tournamentSettlement.update({
        where: { id: existing.id },
        data: {
          status: "DRAFT",
          lockedAt: null,
          lockedByUserId: null,
          memo: body.memo !== undefined ? body.memo : undefined,
        },
      });
      const settlement = await prisma.tournamentSettlement.findUnique({
        where: { tournamentId },
        include: { lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
      });
      const totals = settlement
        ? computeSettlementTotals(settlement.lines)
        : { income: 0, expense: 0, net: 0 };
      return NextResponse.json({ settlement, totals, message: "잠금이 해제되었습니다." });
    }
    return NextResponse.json(
      { error: "잠긴 정산은 수정할 수 없습니다. 먼저 잠금 해제(DRAFT)하세요." },
      { status: 409 }
    );
  }

  let linesToWrite: LineInput[] = [];
  if (body.lines !== undefined) {
    const parsed = validateLines(body.lines);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    linesToWrite = parsed;
  } else if (existing?.lines?.length) {
    linesToWrite = existing.lines.map((L, i) => ({
      category: L.category,
      flow: L.flow,
      amountKrw: L.amountKrw,
      label: L.label,
      note: L.note,
      sortOrder: L.sortOrder ?? i,
    }));
  }

  const nextStatus =
    body.status === "LOCKED" || body.status === "DRAFT" ? body.status : existing?.status ?? "DRAFT";

  const result = await prisma.$transaction(async (tx) => {
    const s = await tx.tournamentSettlement.upsert({
      where: { tournamentId },
      create: {
        tournamentId,
        memo: body.memo ?? null,
        status: nextStatus,
        lockedAt: nextStatus === "LOCKED" ? new Date() : null,
        lockedByUserId: nextStatus === "LOCKED" ? session.id : null,
      },
      update: {
        memo: body.memo !== undefined ? body.memo : undefined,
        status: nextStatus,
        lockedAt: nextStatus === "LOCKED" ? new Date() : null,
        lockedByUserId: nextStatus === "LOCKED" ? session.id : null,
      },
    });

    await tx.tournamentSettlementLine.deleteMany({ where: { settlementId: s.id } });
    if (linesToWrite.length > 0) {
      await tx.tournamentSettlementLine.createMany({
        data: linesToWrite.map((L, i) => ({
          settlementId: s.id,
          category: L.category,
          flow: L.flow,
          amountKrw: L.amountKrw,
          label: L.label,
          note: L.note,
          sortOrder: L.sortOrder ?? i,
        })),
      });
    }

    return tx.tournamentSettlement.findUniqueOrThrow({
      where: { id: s.id },
      include: { lines: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    });
  });

  const totals = computeSettlementTotals(result.lines);
  return NextResponse.json({ settlement: result, totals });
}
