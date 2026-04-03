import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { syncMainBracketMatchProgressStates, fetchOrImportBracketSnapshotByKind } from "@/lib/bracket-match-service";

/** 부전승 연쇄·READY 정리 수동 실행 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "MAIN");
  if (!bracket) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }
  await syncMainBracketMatchProgressStates(prisma, tournamentId);
  return NextResponse.json({ ok: true });
}
