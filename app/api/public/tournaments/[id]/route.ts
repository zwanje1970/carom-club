import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { STAGE_LABELS } from "@/lib/tournament-stage";

/** 공개 대회 상세 (관람용). 로그인 불필요. 비공개(HIDDEN) 대회는 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const tournament = await getPublicTournamentOrNull(id);
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });

  const [zoneCount, finalMatchCount, entryCount, matchVenues] = await Promise.all([
    prisma.tournamentZone.count({ where: { tournamentId: id } }),
    prisma.tournamentFinalMatch.count({ where: { tournamentId: id } }),
    prisma.tournamentEntry.count({ where: { tournamentId: id, status: "CONFIRMED" } }),
    prisma.tournamentMatchVenue.findMany({
      where: { tournamentId: id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, venueNumber: true, displayLabel: true, venueName: true, address: true, phone: true },
    }),
  ]);

  const stage = tournament.tournamentStage ?? "SETUP";
  return NextResponse.json({
    id: tournament.id,
    name: tournament.name,
    title: tournament.title,
    summary: tournament.summary,
    description: tournament.description,
    venue: tournament.venue,
    venueName: tournament.venueName,
    region: tournament.region,
    startAt: tournament.startAt.toISOString(),
    endAt: tournament.endAt?.toISOString() ?? null,
    gameFormat: tournament.gameFormat,
    status: tournament.status,
    tournamentStage: stage,
    tournamentStageLabel: STAGE_LABELS[stage as keyof typeof STAGE_LABELS] ?? stage,
    organization: tournament.organization
      ? { id: tournament.organization.id, name: tournament.organization.name }
      : null,
    zoneCount,
    finalMatchCount,
    hasFinalBracket: finalMatchCount > 0,
    entryCount,
    matchVenues,
  });
}
