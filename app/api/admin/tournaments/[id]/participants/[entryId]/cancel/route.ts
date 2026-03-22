import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canManageTournament } from "@/lib/permissions";
import { cancelTournamentEntryWithWaitlist } from "@/lib/tournament-entry-operations";

/** 관리자: 참가 신청 취소 처리. 확정 취소 시 대기 1순위 자동 승격 및 순번 갱신 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id: tournamentId, entryId } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const result = await cancelTournamentEntryWithWaitlist(tournamentId, entryId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
