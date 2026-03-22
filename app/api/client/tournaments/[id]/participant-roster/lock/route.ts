import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { lockParticipantRoster } from "@/lib/tournament-participant-roster";

/**
 * 참가 명단 확정 실행: CONFIRMED entry id 스냅샷 저장 + 잠금.
 * 기본적으로 대회 상태를 CLOSED로 맞춤(대진표 생성 API 요구사항).
 */
export async function POST(
  request: Request,
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

  let closeRegistration = true;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.closeRegistration === "boolean") closeRegistration = body.closeRegistration;
  } catch {
    // ignore
  }

  const result = await lockParticipantRoster({
    tournamentId,
    lockedByUserId: session.id,
    closeRegistration,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
