import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) return NextResponse.json({ error: "토큰을 찾을 수 없습니다." }, { status: 404 });

  const bracket = await fetchOrImportBracketSnapshotByKind(tournament.id, "FINAL");
  const entryIds = new Set<string>();
  bracket?.rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.entryIdA) entryIds.add(match.entryIdA);
      if (match.entryIdB) entryIds.add(match.entryIdB);
      if (match.winnerEntryId) entryIds.add(match.winnerEntryId);
    });
  });
  const entries = await prisma.tournamentEntry.findMany({
    where: { id: { in: Array.from(entryIds) } },
    include: { user: { select: { name: true } } },
  });
  const entryMap = Object.fromEntries(entries.map((entry) => [entry.id, entry]));

  const rounds =
    bracket?.rounds.map((round) => ({
      roundType: round.roundType,
      roundIndex: round.roundNumber,
      name: round.name,
      targetSize: round.targetSize,
      matches: round.matches.map((match) => ({
        id: match.id,
        roundType: round.roundType,
        roundIndex: round.roundNumber,
        matchIndex: match.matchNumber,
        isBye: match.isBye,
        isReduction: match.isReduction,
        entryAName: match.entryIdA
          ? formatTournamentEntryDisplayName({
              displayName: entryMap[match.entryIdA]?.displayName,
              playerAName: entryMap[match.entryIdA]?.playerAName,
              playerBName: entryMap[match.entryIdA]?.playerBName,
              user: entryMap[match.entryIdA]?.user,
              slotNumber: entryMap[match.entryIdA]?.slotNumber,
              isScotch: tournament.isScotch === true,
            }) || null
          : null,
        entryBName: match.entryIdB
          ? formatTournamentEntryDisplayName({
              displayName: entryMap[match.entryIdB]?.displayName,
              playerAName: entryMap[match.entryIdB]?.playerAName,
              playerBName: entryMap[match.entryIdB]?.playerBName,
              user: entryMap[match.entryIdB]?.user,
              slotNumber: entryMap[match.entryIdB]?.slotNumber,
              isScotch: tournament.isScotch === true,
            }) || null
          : null,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        status: match.status,
        winnerEntryId: match.winnerEntryId,
      })),
    })) ?? [];

  const matches = rounds.flatMap((round) => round.matches);
  const stats = {
    total: matches.length,
    completed: matches.filter((m) => m.status === "COMPLETED").length,
    pending: matches.filter((m) => m.status === "PENDING" || m.status === "READY").length,
    inProgress: matches.filter((m) => m.status === "IN_PROGRESS").length,
    bye: matches.filter((m) => m.isBye).length,
    reduction: rounds.filter((round) => round.roundType === "REDUCTION").reduce((sum, round) => sum + round.matches.length, 0),
  };
  const currentRound = rounds.find((round) => round.matches.some((match) => match.status !== "COMPLETED")) ?? rounds[rounds.length - 1] ?? null;

  return NextResponse.json({
    tournamentName: tournament.name,
    contextLabel: "공개 토큰 TV",
    rounds,
    stats,
    currentRoundLabel: currentRound ? (currentRound.roundType === "REDUCTION" ? "감축경기" : currentRound.name) : null,
    lastUpdatedAt: bracket?.updatedAt?.toISOString() ?? null,
  });
}
