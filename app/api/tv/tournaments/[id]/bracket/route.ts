import { NextResponse } from "next/server";
import { getLatestBracketByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

/**
 * TV 전용 공개 조회: 클라이언트 대진표 GET과 동일한 Firestore 조회 함수만 사용한다.
 * 기존 `app/api/client/tournaments/[id]/bracket/route.ts`는 수정하지 않는다.
 */
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

  const tournamentTitle = tournament?.title?.trim() ?? "";

  return NextResponse.json({
    bracket: bracket ?? null,
    tournamentTitle,
  });
}
