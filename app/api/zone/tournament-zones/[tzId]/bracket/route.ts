import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTournamentZone } from "@/lib/auth-zone";

/** ZONE_MANAGER: 해당 권역 대진표 조회. GET → 본인 배정 권역만. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { tzId } = await params;
  const canView = await canViewTournamentZone(session, tzId);
  if (!canView) return NextResponse.json({ error: "이 권역을 조회할 권한이 없습니다." }, { status: 403 });

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId },
    include: { zone: { select: { name: true, code: true } }, tournament: { select: { id: true, name: true } } },
  });
  if (!tz) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const matches = await prisma.tournamentZoneMatch.findMany({
    where: { tournamentZoneId: tzId },
    orderBy: [{ roundIndex: "asc" }, { matchIndex: "asc" }],
  });

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
    pending: matches.filter((m) => m.status === "PENDING" || m.status === "BYE").length,
    inProgress: matches.filter((m) => m.status === "IN_PROGRESS").length,
  };

  return NextResponse.json({
    tournamentZone: {
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
      tournamentId: tz.tournamentId,
      tournamentName: tz.tournament.name,
    },
    matches: matches.map((m) => ({
      id: m.id,
      roundIndex: m.roundIndex,
      matchIndex: m.matchIndex,
      entryIdA: m.entryIdA,
      entryIdB: m.entryIdB,
      entryAName: m.entryIdA ? entryMap[m.entryIdA]?.user?.name : null,
      entryBName: m.entryIdB ? entryMap[m.entryIdB]?.user?.name : null,
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
