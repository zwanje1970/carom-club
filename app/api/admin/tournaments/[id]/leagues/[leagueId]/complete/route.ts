import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { forceCompleteLeagueByLeagueId } from "@/lib/league-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; leagueId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, leagueId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { reason?: string | null };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const result = await forceCompleteLeagueByLeagueId(leagueId, {
    userId: session.id,
    role: session.role,
    reason: body.reason ?? null,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result);
}
