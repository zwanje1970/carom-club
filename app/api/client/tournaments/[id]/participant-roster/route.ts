import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { computeParticipantRosterSummary } from "@/lib/tournament-participant-roster";

/** 참가 명단 확정 전 요약 (중복 의심·대기·확정 수 등) */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const summary = await computeParticipantRosterSummary(tournamentId);
  if (!summary) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(summary);
}
