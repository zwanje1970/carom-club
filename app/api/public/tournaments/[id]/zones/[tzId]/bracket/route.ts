import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";

/** 공개 권역 대진표. 경기별 참가자명, 점수, 승자, 상태만. */
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
    tournamentId,
    zone: {
      id: tz.id,
      name: tz.name ?? tz.zone.name,
      code: tz.code ?? tz.zone.code,
    },
    matches: matches.map((m) => ({
      id: m.id,
      roundIndex: m.roundIndex,
      matchIndex: m.matchIndex,
      entryIdA: m.entryIdA,
      entryIdB: m.entryIdB,
      entryAName: m.entryIdA ? entryMap[m.entryIdA]?.user?.name ?? null : null,
      entryBName: m.entryIdB ? entryMap[m.entryIdB]?.user?.name ?? null : null,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      winnerEntryId: m.winnerEntryId,
      status: m.status,
    })),
    stats,
  });
}
