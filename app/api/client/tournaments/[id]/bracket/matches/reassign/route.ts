import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../../lib/platform-api";
import { reassignBracketMatchesFirestore } from "../../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type ReassignRequest = {
  sliceKey?: string;
  roundNumber?: number;
  operations?: Array<
    | { type: "swap_within_match"; matchId?: string }
    | {
        type: "swap_between_matches";
        matchAId?: string;
        slotA?: "player1" | "player2";
        matchBId?: string;
        slotB?: "player1" | "player2";
      }
  >;
  autoRebuildAfter?: boolean;
  allowPartialRebuild?: boolean;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

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

  const body = (await request.json().catch(() => null)) as ReassignRequest | null;
  const roundNumber = Number(body?.roundNumber);
  if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
    return NextResponse.json({ error: "roundNumber가 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(body?.operations) || body!.operations.length === 0) {
    return NextResponse.json({ error: "operations가 필요합니다." }, { status: 400 });
  }

  const normalizedOps: Array<
    | { type: "swap_within_match"; matchId: string }
    | { type: "swap_between_matches"; matchAId: string; slotA: "player1" | "player2"; matchBId: string; slotB: "player1" | "player2" }
  > = [];

  for (const op of body.operations) {
    if (!op || typeof op !== "object") continue;
    if (op.type === "swap_within_match") {
      const matchId = typeof op.matchId === "string" ? op.matchId.trim() : "";
      if (!matchId) return NextResponse.json({ error: "swap_within_match.matchId가 필요합니다." }, { status: 400 });
      normalizedOps.push({ type: "swap_within_match", matchId });
      continue;
    }
    if (op.type === "swap_between_matches") {
      const matchAId = typeof op.matchAId === "string" ? op.matchAId.trim() : "";
      const matchBId = typeof op.matchBId === "string" ? op.matchBId.trim() : "";
      const slotA = op.slotA === "player2" ? "player2" : op.slotA === "player1" ? "player1" : null;
      const slotB = op.slotB === "player2" ? "player2" : op.slotB === "player1" ? "player1" : null;
      if (!matchAId || !matchBId || !slotA || !slotB) {
        return NextResponse.json({ error: "swap_between_matches 파라미터가 올바르지 않습니다." }, { status: 400 });
      }
      normalizedOps.push({ type: "swap_between_matches", matchAId, slotA, matchBId, slotB });
    }
  }

  if (normalizedOps.length === 0) {
    return NextResponse.json({ error: "유효한 operations가 없습니다." }, { status: 400 });
  }

  const sliceKey = typeof body.sliceKey === "string" ? body.sliceKey.trim() : undefined;

  const result = await reassignBracketMatchesFirestore({
    tournamentId: id,
    roundNumber: Math.floor(roundNumber),
    operations: normalizedOps,
    autoRebuildAfter: body.autoRebuildAfter !== false,
    allowPartialRebuild: body.allowPartialRebuild !== false,
    ...(bracketZoneId ? { bracketZoneId } : {}),
    ...(sliceKey ? { sliceKey } : {}),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, bracket: result.bracket });
}
