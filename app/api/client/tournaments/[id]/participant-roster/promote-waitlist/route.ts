import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isParticipantRosterLocked } from "@/lib/tournament-roster-lock";
import { promoteAllEligibleWaitlist } from "@/lib/tournament-participant-roster";

export async function POST(
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
  if (await isParticipantRosterLocked(tournamentId)) {
    return NextResponse.json(
      { error: "참가 명단이 이미 확정되어 대기 승격을 실행할 수 없습니다." },
      { status: 409 }
    );
  }

  const { promoted, lastError } = await promoteAllEligibleWaitlist(tournamentId);
  return NextResponse.json({ ok: true, promoted, lastError: lastError ?? null });
}
