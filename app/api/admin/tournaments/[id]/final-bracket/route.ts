import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament } from "@/lib/permissions";
import { fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

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
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL");
  if (!bracket) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }
  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, status: "CONFIRMED" },
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
    matches: bracket.matches.map((m) => ({
      id: m.id,
      tournamentRoundId: m.roundId,
      matchVenueId: m.venueId,
      bracketPhase: bracket.kind,
      roundIndex: bracket.rounds.find((r) => r.id === m.roundId)?.roundNumber ?? 0,
      matchIndex: m.matchNumber,
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
      scheduledStartAt: m.scheduledStartAt ?? null,
      hasIssue: m.hasIssue ?? false,
      issueNote: m.issueNote ?? null,
    })),
    stats,
  });
}
