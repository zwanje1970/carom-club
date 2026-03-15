import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewTournament, canManageTournament } from "@/lib/permissions";
import { buildZoneBracket } from "@/lib/zone-bracket";
import { isQualifierLocked } from "@/lib/tournament-stage";

/** 권역 대진표 조회. GET → canViewTournament */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canViewTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

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
    tournamentZone: {
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

/** 권역 대진표 생성. POST → canManageTournament. 해당 권역 배정 참가자만 사용. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; tzId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, tzId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: { ownerUserId: true } } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (isQualifierLocked(tournament.tournamentStage)) {
    return NextResponse.json(
      { error: "본선 준비가 완료된 후에는 권역 대진표를 생성할 수 없습니다." },
      { status: 409 }
    );
  }

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
  });
  if (!tz) return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });

  const existing = await prisma.tournamentZoneMatch.findFirst({
    where: { tournamentZoneId: tzId },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 대진표가 생성되어 있습니다. 삭제 후 다시 생성하세요." }, { status: 400 });
  }

  const assignedEntries = await prisma.tournamentEntryZoneAssignment.findMany({
    where: { tournamentZoneId: tzId, entry: { status: "CONFIRMED" } },
    include: { entry: true },
  });
  const entryIds = assignedEntries.map((a) => a.entry.id);
  if (entryIds.length < 2) {
    return NextResponse.json(
      { error: "참가 확정된 권역 배정 참가자가 2명 이상 필요합니다." },
      { status: 400 }
    );
  }

  const plan = buildZoneBracket(entryIds);
  if (plan.length === 0) {
    return NextResponse.json({ error: "브래킷을 생성할 수 없습니다." }, { status: 400 });
  }

  const sorted = [...plan].sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
  const createdIds: string[] = [];

  for (const p of sorted) {
    const created = await prisma.tournamentZoneMatch.create({
      data: {
        tournamentId,
        tournamentZoneId: tzId,
        roundIndex: p.roundIndex,
        matchIndex: p.matchIndex,
        entryIdA: p.entryIdA,
        entryIdB: p.entryIdB,
        status: p.status,
        nextMatchId: null,
        nextSlot: null,
      },
    });
    createdIds.push(created.id);
  }

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const nextRound = p.roundIndex + 1;
    const nextMatchIndex = Math.floor(p.matchIndex / 2);
    const nextSlot = (p.matchIndex % 2 === 0 ? "A" : "B") as "A" | "B";
    const j = sorted.findIndex((q) => q.roundIndex === nextRound && q.matchIndex === nextMatchIndex);
    if (j >= 0 && createdIds[j]) {
      await prisma.tournamentZoneMatch.update({
        where: { id: createdIds[i] },
        data: { nextMatchId: createdIds[j], nextSlot },
      });
    }
  }

  if (tournament.tournamentStage === "SETUP") {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tournamentStage: "QUALIFIER_RUNNING" },
    });
  }
  return NextResponse.json({ ok: true, matchCount: plan.length });
}
