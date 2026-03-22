import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { rejectTournamentEntryApplied } from "@/lib/tournament-entry-operations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: tournamentId, entryId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  let body: { rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const rejectionReason = typeof body?.rejectionReason === "string" ? body.rejectionReason.trim() || null : null;

  const result = await rejectTournamentEntryApplied(tournamentId, entryId, rejectionReason);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, status: result.status });
}
