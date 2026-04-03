import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { cancelTournamentEntryWithWaitlist } from "@/lib/tournament-entry-operations";

/** 참가 신청 취소. 확정 참가 취소 시 대기 1순위 자동 승격 및 대기순번 갱신 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const { entryId } = body as { entryId?: string };
  if (!entryId) {
    return NextResponse.json({ error: "entryId가 필요합니다." }, { status: 400 });
  }

  const result = await cancelTournamentEntryWithWaitlist(session.id, entryId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
