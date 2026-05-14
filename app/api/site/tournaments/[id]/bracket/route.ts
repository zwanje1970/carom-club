import { NextResponse } from "next/server";
import { getLatestBracketByTournamentIdFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

/** 공개 대회안내용 대진표 조회 — TV API와 동일 Firestore 조회만 사용 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const url = new URL(request.url);
  const metaOnly = url.searchParams.get("meta") === "1";

  const [tournament, bracket] = await Promise.all([
    getTournamentByIdFirestore(tid),
    getLatestBracketByTournamentIdFirestore(tid),
  ]);

  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  if (metaOnly) {
    const updatedAt =
      typeof bracket?.updatedAt === "string" && bracket.updatedAt.trim() !== ""
        ? bracket.updatedAt.trim()
        : typeof bracket?.createdAt === "string"
          ? bracket.createdAt
          : null;
    return NextResponse.json({
      updatedAt,
      bracketId: bracket?.id ?? null,
      statusBadge: tournament.statusBadge,
    });
  }

  const tournamentTitle = tournament.title?.trim() ?? "";

  return NextResponse.json({
    bracket: bracket ?? null,
    tournamentTitle,
    statusBadge: tournament.statusBadge,
  });
}
