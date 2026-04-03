import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { createOrRebuildLeagueFromTournament, getLeagueDetail } from "@/lib/league-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const leagues = await prisma.league.findMany({
    where: { tournamentId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    include: {
      _count: {
        select: { entries: true, rounds: true, matches: true, standings: true },
      },
    },
  });

  return NextResponse.json({
    tournamentId,
    leagues: leagues.map((league) => ({
      id: league.id,
      kind: league.kind,
      zoneId: league.zoneId,
      status: league.status,
      generatedAt: league.generatedAt?.toISOString() ?? null,
      completedAt: league.completedAt?.toISOString() ?? null,
      pointsForWin: league.pointsForWin,
      pointsForDraw: league.pointsForDraw,
      pointsForLoss: league.pointsForLoss,
      tieBreaker: league.tieBreaker,
      counts: league._count,
    })),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: {
    kind?: "MAIN" | "ZONE" | "FINAL";
    zoneId?: string | null;
    matchDayId?: string | null;
    pointsForWin?: number;
    pointsForDraw?: number;
    pointsForLoss?: number;
    tieBreaker?: "HEAD_TO_HEAD" | "SCORE_DIFF" | "SCORE_FOR" | "DRAW_COUNT";
    seedFromConfirmedEntries?: boolean;
    reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const kind = body.kind ?? "MAIN";
  if (kind === "ZONE" && !body.zoneId) {
    return NextResponse.json({ error: "ZONE 리그는 zoneId가 필요합니다." }, { status: 400 });
  }

  const result = await createOrRebuildLeagueFromTournament({
    tournamentId,
    kind,
    zoneId: body.zoneId ?? null,
    matchDayId: body.matchDayId ?? null,
    pointsForWin: body.pointsForWin,
    pointsForDraw: body.pointsForDraw,
    pointsForLoss: body.pointsForLoss,
    tieBreaker: body.tieBreaker,
    seedFromConfirmedEntries: body.seedFromConfirmedEntries,
    actorUserId: session.id,
    actorRole: session.role,
    reason: body.reason ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const league = await getLeagueDetail(result.leagueId);
  return NextResponse.json({
    ok: true,
    league,
    created: {
      roundCount: result.roundCount,
      matchCount: result.matchCount,
      entryCount: result.entryCount,
    },
  });
}
