import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { patchLeagueMatchResult } from "@/lib/league-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; leagueId: string; matchId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, leagueId, matchId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: {
    scoreA?: number;
    scoreB?: number;
    winnerLeagueEntryId?: string | null;
    status?: "PENDING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
    note?: string | null;
    reason?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (typeof body.scoreA !== "number" || typeof body.scoreB !== "number") {
    return NextResponse.json({ error: "scoreA, scoreB는 숫자여야 합니다." }, { status: 400 });
  }

  const result = await patchLeagueMatchResult({
    leagueId,
    matchId,
    scoreA: body.scoreA,
    scoreB: body.scoreB,
    winnerLeagueEntryId: body.winnerLeagueEntryId ?? null,
    status: body.status,
    note: body.note ?? null,
    actorUserId: session.id,
    actorRole: session.role,
    reason: body.reason ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, standingsCount: result.standingsCount });
}
