import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

/** 공개 권역 대진표. 경기별 참가자명, 점수, 승자, 상태만. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const { id: tournamentId, tzId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
    include: { zone: { select: { name: true, code: true } } },
  });
  if (!tz) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const bracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, tzId);
  const matches = bracket?.rounds.flatMap((round) =>
    round.matches.map((match) => ({
      id: match.id,
      roundType: match.isReduction ? "REDUCTION" : "NORMAL",
      roundIndex: round.roundNumber,
      matchIndex: match.matchNumber,
      isBye: match.isBye,
      isReduction: match.isReduction,
      entryIdA: match.entryIdA,
      entryIdB: match.entryIdB,
      winnerEntryId: match.winnerEntryId,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      status: match.status,
    }))
  ) ?? [];

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

  const stats = {
    total: matches.length,
    completed: matches.filter((m) => m.status === "COMPLETED").length,
    pending: matches.filter((m) => m.status === "PENDING" || m.status === "READY").length,
    inProgress: matches.filter((m) => m.status === "IN_PROGRESS").length,
  };

  return NextResponse.json({
    tournamentId,
    zone: {
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
    },
    rounds: bracket?.rounds.map((round) => ({
      roundType: round.matches.some((match) => match.isReduction) ? "REDUCTION" : "NORMAL",
      roundIndex: round.roundNumber,
      name: round.name,
      targetSize: round.targetSize,
      matches: round.matches.map((match) => ({
        id: match.id,
        roundType: match.isReduction ? "REDUCTION" : "NORMAL",
        roundIndex: round.roundNumber,
        matchIndex: match.matchNumber,
        isBye: match.isBye,
        isReduction: match.isReduction,
        entryIdA: match.entryIdA,
        entryIdB: match.entryIdB,
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
        winnerEntryId: match.winnerEntryId,
        status: match.status,
      })),
    })) ?? [],
    matches: matches.map((m) => ({
      id: m.id,
      roundType: m.roundType,
      roundIndex: m.roundIndex,
      matchIndex: m.matchIndex,
      isBye: m.isBye,
      isReduction: m.isReduction,
      entryIdA: m.entryIdA,
      entryIdB: m.entryIdB,
      entryAName: m.entryIdA
        ? formatTournamentEntryDisplayName({
            displayName: entryMap[m.entryIdA]?.displayName,
            playerAName: entryMap[m.entryIdA]?.playerAName,
            playerBName: entryMap[m.entryIdA]?.playerBName,
            user: entryMap[m.entryIdA]?.user,
            slotNumber: entryMap[m.entryIdA]?.slotNumber,
            isScotch: tournament.isScotch === true,
          }) || null
        : null,
      entryBName: m.entryIdB
        ? formatTournamentEntryDisplayName({
            displayName: entryMap[m.entryIdB]?.displayName,
            playerAName: entryMap[m.entryIdB]?.playerAName,
            playerBName: entryMap[m.entryIdB]?.playerBName,
            user: entryMap[m.entryIdB]?.user,
            slotNumber: entryMap[m.entryIdB]?.slotNumber,
            isScotch: tournament.isScotch === true,
          }) || null
        : null,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerEntryId: m.winnerEntryId,
      status: m.status,
    })),
    stats,
  });
}
