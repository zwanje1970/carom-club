import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

/** 공개 본선 대진표. 로그인 불필요. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL");
  if (!bracket) {
    return NextResponse.json({
      tournamentId,
      tournamentName: tournament.name,
      matches: [],
      stats: { total: 0, completed: 0, pending: 0 },
    });
  }

  const entryIds = new Set<string>();
  bracket.matches.forEach((m) => {
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
    if (!e) return null;
    return (
      formatTournamentEntryDisplayName({
        displayName: e.displayName,
        playerAName: e.playerAName,
        playerBName: e.playerBName,
        user: e.user,
        slotNumber: e.slotNumber,
        isScotch: tournament.isScotch === true,
      }) || null
    );
  };

  const stats = {
    total: bracket.matches.length,
    completed: bracket.matches.filter((m) => m.status === "COMPLETED").length,
    pending: bracket.matches.filter((m) => m.status === "PENDING" || m.status === "READY" || m.isBye).length,
  };

  return NextResponse.json({
    tournamentId,
    tournamentName: tournament.name,
    matches: bracket.matches.map((m) => ({
      id: m.id,
      tournamentRoundId: m.roundId,
      matchVenueId: m.venueId,
      bracketPhase: bracket.kind,
      roundIndex: bracket.rounds.find((r) => r.id === m.roundId)?.roundNumber ?? 0,
      matchIndex: m.matchNumber,
      /** 선수 슬롯 1·2 (TournamentEntry id) */
      entryIdA: m.entryIdA,
      entryIdB: m.entryIdB,
      entryAName: entryDisplayName(m.entryIdA),
      entryBName: entryDisplayName(m.entryIdB),
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerEntryId: m.winnerEntryId,
      status: m.isBye && m.status !== "COMPLETED" ? "BYE" : m.status,
      nextMatchId: m.nextMatchId,
      nextSlot: m.nextSlot,
    })),
    stats,
  });
}
