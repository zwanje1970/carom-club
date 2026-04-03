import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportBracketSnapshotByKind, fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";

/** 공개 경기 결과 요약. 권역별 완료 현황 + 본선 완료 현황. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const zones = await prisma.tournamentZone.findMany({
    where: { tournamentId },
    orderBy: { sortOrder: "asc" },
    include: { zone: { select: { name: true, code: true } } },
  });
  const [zoneStats, bracket] = await Promise.all([
    Promise.all(
      zones.map(async (z) => {
        const zoneBracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, z.id);
        const matches = zoneBracket?.rounds.flatMap((round) => round.matches) ?? [];
        return {
          total: matches.length,
          completed: matches.filter((m) => m.status === "COMPLETED").length,
        };
      })
    ),
    fetchOrImportBracketSnapshotByKind(tournamentId, "FINAL"),
  ]);
  const zoneTotal = zoneStats.reduce((sum, z) => sum + z.total, 0);
  const zoneCompleted = zoneStats.reduce((sum, z) => sum + z.completed, 0);
  const finalCompleted = bracket?.matches.filter((m) => m.status === "COMPLETED").length ?? 0;
  const finalTotal = bracket?.matches.length ?? 0;

  return NextResponse.json({
    tournamentId,
    tournamentName: tournament.name,
    tournamentStage: tournament.tournamentStage ?? "SETUP",
    zoneResults: {
      total: zoneTotal,
      completed: zoneCompleted,
    },
    finalResults: {
      total: finalTotal,
      completed: finalCompleted,
    },
    zones: zones.map((z) => ({ id: z.id, name: z.name ?? z.zone.name, code: z.code ?? z.zone.code })),
  });
}
