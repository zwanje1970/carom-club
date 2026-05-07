import { NextResponse } from "next/server";
import { getLatestBracketByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

/** 공개 대회안내용 대진표 조회 — TV API와 동일 Firestore 조회만 사용 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const [tournament, bracket] = await Promise.all([
    getTournamentByIdFirestore(tid),
    getLatestBracketByTournamentIdFirestore(tid),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const tournamentTitle = tournament.title?.trim() ?? "";

  return NextResponse.json({
    bracket: bracket ?? null,
    tournamentTitle,
    statusBadge: tournament.statusBadge,
  });
}
