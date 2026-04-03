import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { fetchOrImportZoneBracketSnapshotByZoneId } from "@/lib/bracket-match-service";

/** 공개 권역 상세. 참가자 수, 경기 수 등. */
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

  const [bracket, participantCount] = await Promise.all([
    fetchOrImportZoneBracketSnapshotByZoneId(tournamentId, tzId),
    prisma.tournamentEntry.count({
      where: { tournamentId, zoneId: tzId, status: "CONFIRMED" },
    }),
  ]);
  const matches = bracket?.rounds.flatMap((round) => round.matches) ?? [];
  const matchTotal = matches.length;
  const matchCompleted = matches.filter((m) => m.status === "COMPLETED").length;

  return NextResponse.json({
    tournamentId,
    zone: {
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
      participantCount,
      matchTotal,
      matchCompleted,
    },
  });
}
