import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

/** 공개 본선 대진표. 로그인 불필요. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

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
    tournamentName: tournament.name,
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
    })),
    stats,
  });
}
