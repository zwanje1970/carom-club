import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

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

  const zoneIds = zones.map((z) => z.id);
  const [matchCounts, completedCounts, assignmentCounts] = await Promise.all([
    prisma.tournamentZoneMatch.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds } },
      _count: { id: true },
    }),
    prisma.tournamentZoneMatch.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds }, status: "COMPLETED" },
      _count: { id: true },
    }),
    prisma.tournamentEntryZoneAssignment.groupBy({
      by: ["tournamentZoneId"],
      where: { tournamentZoneId: { in: zoneIds }, entry: { status: "CONFIRMED" } },
      _count: { id: true },
    }),
  ]);

  const totalByZone = Object.fromEntries(matchCounts.map((m) => [m.tournamentZoneId, m._count.id]));
  const completedByZone = Object.fromEntries(completedCounts.map((m) => [m.tournamentZoneId, m._count.id]));
  const participantCountByZone = Object.fromEntries(assignmentCounts.map((m) => [m.tournamentZoneId, m._count.id]));

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
