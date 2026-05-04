import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../../../lib/platform-api";
import { updateBracketMatchResultFirestore } from "../../../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type MatchResultRequest = {
  winnerUserId?: string | null;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; matchId: string }> }
) {
  const { id, matchId } = await context.params;
  if (!id.trim() || !matchId.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

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

  const bracketZoneId = request.nextUrl.searchParams.get("zoneId")?.trim() ?? "";
  if (auth.tournament.zonesEnabled === true && auth.access.kind === "zone_manager") {
    if (!bracketZoneId || !zoneManagerMayAccessZoneId(auth.access, bracketZoneId)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
  }

  const body = (await request.json().catch(() => null)) as MatchResultRequest | null;
  if (!body || !("winnerUserId" in body)) {
    return NextResponse.json({ error: "winnerUserId 필드가 필요합니다." }, { status: 400 });
  }

  const winnerUserId =
    body.winnerUserId === null
      ? null
      : typeof body.winnerUserId === "string"
        ? body.winnerUserId.trim()
        : "";
  if (winnerUserId !== null && !winnerUserId) {
    return NextResponse.json({ error: "winnerUserId 값이 올바르지 않습니다." }, { status: 400 });
  }

  const result = await updateBracketMatchResultFirestore({
    tournamentId: id,
    matchId,
    winnerUserId,
    actorUserId: user.id,
    ...(bracketZoneId ? { bracketZoneId } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, bracket: result.bracket });
}
