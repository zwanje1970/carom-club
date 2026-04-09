import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchOrImportBracketSnapshotByKind, fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { computeAllZoneQualifiers } from "@/lib/final-qualification";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) return NextResponse.json({ error: "토큰을 찾을 수 없습니다." }, { status: 404 });

  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId: tournament.id },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } } },
  });
  const [zoneStats, bracket, qualifiers] = await Promise.all([
    Promise.all(
      zones.map(async (zone) => {
        const zoneBracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournament.id, zone.id);
        const rounds = zoneBracket?.rounds ?? [];
        const matches = rounds.flatMap((round) => round.matches);
        const reductionMatches = rounds
          .flatMap((round) => round.matches)
          .filter((match) => match.isReduction)
          .length;
        const currentRound = rounds.find((round) => round.matches.some((match) => match.status !== "COMPLETED")) ?? rounds[rounds.length - 1] ?? null;

        return {
          id: zone.id,
          name: zone.name ?? zone.zone.name,
          code: zone.code ?? zone.zone.code,
          total: matches.length,
          completed: matches.filter((match) => match.status === "COMPLETED").length,
          pending: matches.filter((match) => match.status === "PENDING" || match.status === "READY").length,
          reductionMatches,
          currentRoundLabel: currentRound ? (currentRound.matches.some((match) => match.isReduction) ? "감축경기" : currentRound.name) : null,
        };
      })
    ),
    fetchOrImportBracketSnapshotByKind(tournament.id, "FINAL"),
    computeAllZoneQualifiers(tournament.id),
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
