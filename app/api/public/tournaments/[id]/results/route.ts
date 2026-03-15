import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

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
  const zoneIds = zones.map((z) => z.id);

  const [zoneCompleted, zoneTotal, finalCompleted, finalTotal] = await Promise.all([
    prisma.tournamentZoneMatch.count({
      where: { tournamentZoneId: { in: zoneIds }, status: "COMPLETED" },
    }),
    prisma.tournamentZoneMatch.count({
      where: { tournamentZoneId: { in: zoneIds } },
    }),
    prisma.tournamentFinalMatch.count({
      where: { tournamentId, status: "COMPLETED" },
    }),
    prisma.tournamentFinalMatch.count({
      where: { tournamentId },
    }),
  ]);

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
