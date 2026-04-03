import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTournamentZone } from "@/lib/auth-zone";
import { formatTournamentEntryDisplayName } from "@/lib/tournament-entry-display";

/** ZONE_MANAGER: 해당 권역(TournamentZone) 참가자 목록. GET → 본인 배정 권역만. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { tzId } = await params;
  const canView = await canViewTournamentZone(session, tzId);
  if (!canView) return NextResponse.json({ error: "이 권역을 조회할 권한이 없습니다." }, { status: 403 });

  const tz = await prisma.tournamentZone.findUnique({
    where: { id: tzId },
    include: {
      tournament: { select: { id: true, name: true, isScotch: true } },
      zone: { select: { name: true, code: true } },
    },
  });
  if (!tz) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId: tz.tournamentId, zoneId: tzId },
    include: { user: { include: { memberProfile: { select: { handicap: true, avg: true } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  const participants = entries.map((entry) => ({
    entryId: entry.id,
    userId: entry.userId,
    userName: formatTournamentEntryDisplayName({
      displayName: entry.displayName,
      playerAName: entry.playerAName,
      playerBName: entry.playerBName,
      user: entry.user,
      slotNumber: entry.slotNumber,
      isScotch: tz.tournament.isScotch === true,
    }),
    handicap: entry.user.memberProfile?.handicap ?? null,
    avg: entry.user.memberProfile?.avg ?? null,
    status: entry.status,
  }));

  return NextResponse.json({
    tournamentZone: {
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
      tournamentId: tz.tournamentId,
      tournamentName: tz.tournament.name,
    },
    participants,
    count: participants.length,
  });
}
