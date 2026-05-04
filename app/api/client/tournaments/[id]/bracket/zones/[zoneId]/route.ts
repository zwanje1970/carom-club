import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../../lib/platform-api";
import { getLatestBracketByTournamentIdAndZoneIdFirestore } from "../../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; zoneId: string }> }
) {
  const { id, zoneId } = await context.params;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const auth = await authorizeClientTournamentBracketContext({ user, tournamentId: id });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.httpStatus });
  }

  const zid = zoneId.trim();
  if (!zid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (auth.access.kind === "zone_manager" && !zoneManagerMayAccessZoneId(auth.access, zid)) {
    return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
  }

  const bracket = await getLatestBracketByTournamentIdAndZoneIdFirestore(id, zid);
  return NextResponse.json({ bracket: bracket ?? null });
}
