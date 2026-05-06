import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../../../lib/platform-api";
import { rebuildBracketRoundFirestore } from "../../../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type RebuildRoundRequest = {
  allowPartial?: boolean;
  sliceKey?: string;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; roundNumber: string }> },
) {
  const { id, roundNumber } = await context.params;
  const parsedRoundNumber = Number.parseInt(roundNumber, 10);
  if (!Number.isFinite(parsedRoundNumber) || parsedRoundNumber <= 0) {
    return NextResponse.json({ error: "유효한 roundNumber가 필요합니다." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const user = await getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });

  const auth = await authorizeClientTournamentBracketContext({ user, tournamentId: id });
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.httpStatus });

  const bracketZoneId = request.nextUrl.searchParams.get("zoneId")?.trim() ?? "";
  if (auth.tournament.zonesEnabled === true && auth.access.kind === "zone_manager") {
    if (!bracketZoneId || !zoneManagerMayAccessZoneId(auth.access, bracketZoneId)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
  }

  const body = (await request.json().catch(() => null)) as RebuildRoundRequest | null;
  const allowPartial = body?.allowPartial === true;
  const sliceKey = typeof body?.sliceKey === "string" ? body.sliceKey.trim() : undefined;
  const result = await rebuildBracketRoundFirestore({
    tournamentId: id,
    roundNumber: parsedRoundNumber,
    allowPartial,
    ...(bracketZoneId ? { bracketZoneId } : {}),
    ...(sliceKey ? { sliceKey } : {}),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, bracket: result.bracket });
}
