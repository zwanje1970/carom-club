import { NextResponse } from "next/server";
import { getLatestBracketByTournamentIdAndZoneIdFirestore } from "../../../../../../../lib/server/firestore-tournament-brackets";
import { findTournamentZoneByTvAccessToken } from "../../../../../../../lib/server/firestore-tournament-zones";
import { getTournamentByIdFirestore } from "../../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

/**
 * 권역 TV 공개(토큰): 해당 zoneId 기준 최신 브라켓.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token: raw } = await context.params;
  const token = raw.trim();
  if (!token) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const zone = await findTournamentZoneByTvAccessToken(token);
  if (!zone) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const tournament = await getTournamentByIdFirestore(zone.tournamentId);
  if (!tournament || tournament.status === "DELETED") {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const bracket = await getLatestBracketByTournamentIdAndZoneIdFirestore(zone.tournamentId, zone.id);
  const tournamentTitle = tournament.title?.trim() ?? "";
  const zoneName = zone.zoneName?.trim() ?? "";

  return NextResponse.json({
    bracket: bracket ?? null,
    tournamentTitle,
    zoneName,
  });
}
