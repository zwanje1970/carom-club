import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { buildZoneBracket } from "@/lib/zone-bracket";
import { isQualifierLocked } from "@/lib/tournament-stage";
import { createZoneBracketMatchesFromPlan, fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

/** 권역 대진표 조회. GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

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
      nextMatchId: match.nextMatchId,
      nextSlot: match.nextSlot,
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
    tournamentZone: {
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
        nextMatchId: match.nextMatchId,
        nextSlot: match.nextSlot,
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
      nextMatchId: m.nextMatchId,
      nextSlot: m.nextSlot,
    })),
    stats,
  });
}

/** 권역 대진표 생성. POST → canManageTournament. 해당 권역 배정 참가자만 사용. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 대진표를 생성할 수 없습니다." },
      { status: 409 }
    );
  }

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
  });
  if (!tz) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const existing = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, tzId);
  if (existing) {
    return NextResponse.json({ error: "이미 대진표가 생성되어 있습니다. 삭제 후 다시 생성하세요." }, { status: 400 });
  }

  const assignedEntries = await prisma.tournamentEntry.findMany({
    where: { tournamentId, zoneId: tzId, status: "CONFIRMED" },
    orderBy: [{ bracketOrder: "asc" }, { levelCode: "asc" }, { id: "asc" }],
    select: { id: true, levelCode: true, bracketOrder: true },
  });
  if (assignedEntries.length < 2) {
    return NextResponse.json(
      { error: "참가 확정된 권역 배정 참가자가 2명 이상 필요합니다." },
      { status: 400 }
    );
  }

  const plan = buildZoneBracket(
    assignedEntries.map((entry) => ({
      entryId: entry.id,
      levelCode: entry.levelCode,
      bracketOrder: entry.bracketOrder,
    }))
  );
  if (plan.rounds.length === 0) {
    return NextResponse.json({ error: "브래킷을 생성할 수 없습니다." }, { status: 400 });
  }

  const created = await prisma.$transaction(async (tx) => {
    const result = await createZoneBracketMatchesFromPlan(tx, {
      tournamentId,
      zoneId: tzId,
      plan,
    });
    return result;
  });

  if (tournament.tournamentStage === "SETUP") {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "QUALIFIER_RUNNING" },
    });
  }
  return NextResponse.json({
    ok: true,
    bracketId: created.bracketId,
    matchCount: plan.rounds.flatMap((round) => round.matches).length,
    reductionMatchCount: plan.reductionMatchCount,
    reductionRoundCount: plan.rounds.filter((round) => round.roundType === "REDUCTION").length,
    manualReviewRequired: plan.manualReviewRequired,
  });
}
