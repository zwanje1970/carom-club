import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

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

  const venues = await prisma.tournamentMatchVenue.findMany({
    where: { tournamentId },
    orderBy: [{ sortOrder: "asc" }, { venueNumber: "asc" }],
    select: { id: true },
  });
  const venueIds = venues.map((v) => v.id);

  const matches = await prisma.tournamentFinalMatch.findMany({
    where: { tournamentId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
  });
  if (matches.length === 0) {
    return NextResponse.json({ error: "대진 경기가 없습니다." }, { status: 400 });
  }

  const byRound = new Map<number, typeof matches>();
  for (const m of matches) {
    if (!byRound.has(m.roundIndex)) byRound.set(m.roundIndex, []);
    byRound.get(m.roundIndex)!.push(m);
  }
  const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);

  let cursor = base.getTime();
  let updated = 0;

  for (const ri of rounds) {
    const list = byRound.get(ri)!;
    const sorted = [...list].sort((a, b) => {
      const va = a.matchVenueId ? venueIds.indexOf(a.matchVenueId) : 999;
      const vb = b.matchVenueId ? venueIds.indexOf(b.matchVenueId) : 999;
      if (va !== vb) return va - vb;
      return a.matchIndex - b.matchIndex;
    });
    for (const m of sorted) {
      await prisma.tournamentFinalMatch.update({
        where: { id: m.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { scheduledStartAt: new Date(cursor) } as any,
      });
      cursor += interval * 60 * 1000;
      updated++;
    }
    cursor += roundGap * 60 * 1000;
  }

  return NextResponse.json({ ok: true, updated });
}
