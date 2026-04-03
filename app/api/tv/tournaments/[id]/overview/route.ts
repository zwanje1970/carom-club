import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament } from "@/lib/permissions";
import { computeAllZoneQualifiers } from "@/lib/final-qualification";
import { fetchOrImportBracketSnapshotByKind, fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";

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

  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } } },
  });
  const [zoneStats, bracket, qualifiers] = await Promise.all([
    Promise.all(
      zones.map(async (zone) => {
        const zoneBracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, zone.id);
        const rounds = zoneBracket?.rounds ?? [];
        const matches = rounds.flatMap((round) => round.matches);
        const reductionMatches = rounds
          .filter((round) => round.roundType === "REDUCTION")
          .reduce((sum, round) => sum + round.matches.length, 0);
        const currentRound = rounds.find((round) => round.matches.some((match) => match.status !== "COMPLETED")) ?? rounds[rounds.length - 1] ?? null;

        return {
          id: zone.id,
          name: zone.name ?? zone.zone.name,
          code: zone.code ?? zone.zone.code,
          total: matches.length,
          completed: matches.filter((match) => match.status === "COMPLETED").length,
          pending: matches.filter((match) => match.status === "PENDING" || match.status === "READY").length,
          reductionMatches,
          currentRoundLabel: currentRound ? (currentRound.roundType === "REDUCTION" ? "감축경기" : currentRound.name) : null,
        };
      })
    ),
    fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL"),
    computeAllZoneQualifiers(tournamentId),
  ]);

  const zoneTotal = zoneStats.reduce((sum, zone) => sum + zone.total, 0);
  const zoneCompleted = zoneStats.reduce((sum, zone) => sum + zone.completed, 0);
  const zoneReductionTotal = zoneStats.reduce((sum, zone) => sum + zone.reductionMatches, 0);

  return NextResponse.json({
    tournamentName: tournament.name,
    tournamentStage: tournament.tournamentStage ?? "SETUP",
    zoneCount: zones.length,
    zoneCompleted,
    zoneTotal,
    zoneReductionTotal,
    qualifiedCount: qualifiers.total,
    finalBracketCreated: Boolean(bracket && bracket.matches.length > 0),
    finalTotal: bracket?.matches.length ?? 0,
    finalCompleted: bracket?.matches.filter((match) => match.status === "COMPLETED").length ?? 0,
    zones: zoneStats,
    lastUpdatedAt: new Date().toISOString(),
  });
}
