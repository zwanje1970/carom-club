import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { autoSortMainBracketMatches, fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";

/**
 * 예정 시각 자동 배치: 라운드 순 → 경기장 순 → 매치 순으로 슬롯을 채움.
 * body: baseStartAt (ISO), intervalMinutes (기본 25), roundGapMinutes (라운드 전환 추가 버퍼, 기본 5)
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { baseStartAt?: string; intervalMinutes?: number; roundGapMinutes?: number };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const base = body.baseStartAt ? new Date(body.baseStartAt) : null;
  if (!base || Number.isNaN(base.getTime())) {
    return NextResponse.json({ error: "baseStartAt(ISO 시각)이 필요합니다." }, { status: 400 });
  }
  const interval = Math.max(5, Math.min(180, Number(body.intervalMinutes) || 25));
  const roundGap = Math.max(0, Math.min(120, Number(body.roundGapMinutes) ?? 5));

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "MAIN");
  if (bracket) {
    const updated = await autoSortMainBracketMatches(prisma, tournamentId, {
      baseStartAt: base,
      intervalMinutes: interval,
      roundGapMinutes: roundGap,
    });
    return NextResponse.json({ ok: true, updated });
  }
  return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
}
