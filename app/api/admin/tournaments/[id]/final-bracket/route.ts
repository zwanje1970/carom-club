import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTournament } from "@/lib/permissions";

/** 본선 대진표 조회. GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const matches = await prisma.tournamentFinalMatch.findMany({
    where: { tournamentId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
  });

  const entryIds = new Set<string>();
  matches.forEach((m) => {
    if (m.entryIdA) entryIds.add(m.entryIdA);
    if (m.entryIdB) entryIds.add(m.entryIdB);
    if (m.winnerEntryId) entryIds.add(m.winnerEntryId);
  });
  const entries = await prisma.tournamentEntry.findMany({
    where: { id: { in: Array.from(entryIds) } },
    include: { user: { select: { name: true } } },
  });
  const entryMap = Object.fromEntries(entries.map((e) => [e.id, e]));
  const entryDisplayName = (entryId: string | null) => {
    if (!entryId) return null;
    const e = entryMap[entryId];
    if (!e?.user?.name) return null;
    const slot = e.slotNumber ?? 1;
    return slot > 1 ? `${e.user.name} (슬롯${slot})` : e.user.name;
  };

  const stats = {
    total: matches.length,
    completed: matches.filter((m) => m.status === "COMPLETED").length,
    pending: matches.filter((m) => m.status === "PENDING" || m.status === "BYE").length,
  };

  return NextResponse.json({
    tournamentId,
    matches: matches.map((m) => ({
      id: m.id,
      roundIndex: m.roundIndex,
      matchIndex: m.matchIndex,
      entryIdA: m.entryIdA,
      entryIdB: m.entryIdB,
      entryAName: entryDisplayName(m.entryIdA),
      entryBName: entryDisplayName(m.entryIdB),
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerEntryId: m.winnerEntryId,
      status: m.status,
      nextMatchId: m.nextMatchId,
      nextSlot: m.nextSlot,
    })),
    stats,
  });
}
