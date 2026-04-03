import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";

/** 공개 권역 목록. 로그인 불필요. */
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
  const zoneStats = await Promise.all(
    zones.map(async (z) => {
      const bracket = await fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, z.id);
      const matches = bracket?.rounds.flatMap((round) => round.matches) ?? [];
      const participants = await prisma.tournamentEntry.count({
        where: { tournamentId, zoneId: z.id, status: "CONFIRMED" },
      });
      return {
        zoneId: z.id,
        total: matches.length,
        completed: matches.filter((m) => m.status === "COMPLETED").length,
        participants,
      };
    })
  );
  const totalByZone = Object.fromEntries(zoneStats.map((z) => [z.zoneId, z.total]));
  const completedByZone = Object.fromEntries(zoneStats.map((z) => [z.zoneId, z.completed]));
  const participantCountByZone = Object.fromEntries(zoneStats.map((z) => [z.zoneId, z.participants]));

  return NextResponse.json({
    tournamentId,
    zones: zones.map((z) => ({
      id: z.id,
      name: z.name ?? z.zone.name,
      code: z.code ?? z.zone.code,
      participantCount: participantCountByZone[z.id] ?? 0,
      matchTotal: totalByZone[z.id] ?? 0,
      matchCompleted: completedByZone[z.id] ?? 0,
    })),
  });
}
