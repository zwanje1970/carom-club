import { NextResponse } from "next/server";
import { getLatestBracketByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import {
  findTournamentIdByTvAccessTokenFirestore,
  getTournamentByIdFirestore,
} from "../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

/**
 * TV 공개(토큰): `/api/tv/tournaments/[id]/bracket`과 동일한 JSON 형태.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token: raw } = await context.params;
  const token = raw.trim();
  if (!token) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const tournamentId = await findTournamentIdByTvAccessTokenFirestore(token);
  if (!tournamentId) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const [tournament, bracket] = await Promise.all([
    getTournamentByIdFirestore(tournamentId),
    getLatestBracketByTournamentIdFirestore(tournamentId),
  ]);

  const tournamentTitle = tournament?.title?.trim() ?? "";

  return NextResponse.json({
    bracket: bracket ?? null,
    tournamentTitle,
  });
}
