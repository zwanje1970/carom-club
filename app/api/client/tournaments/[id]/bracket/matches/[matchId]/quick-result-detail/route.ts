import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../../../lib/platform-api";
import { updateBracketMatchQuickResultDetailFirestore } from "../../../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type Body = {
  firstAttackUserId?: string;
  scorePlayer1?: unknown;
  scorePlayer2?: unknown;
  endInning?: unknown;
  highRunPlayer1?: unknown;
  highRunPlayer2?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; matchId: string }> },
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

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body || typeof body.firstAttackUserId !== "string") {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const parseNullableInt = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? n : null;
  };

  const highRunPlayer1 = parseNullableInt(body.highRunPlayer1);
  const highRunPlayer2 = parseNullableInt(body.highRunPlayer2);

  const result = await updateBracketMatchQuickResultDetailFirestore({
    tournamentId: id,
    matchId,
    firstAttackUserId: body.firstAttackUserId,
    scorePlayer1: Number(body.scorePlayer1),
    scorePlayer2: Number(body.scorePlayer2),
    endInning: Number(body.endInning),
    highRunPlayer1,
    highRunPlayer2,
    ...(bracketZoneId ? { bracketZoneId } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, bracket: result.bracket });
}
