import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../../lib/auth/session";
import { checkClientFeatureAccessByUserId, getUserById } from "../../../../../../../../../lib/platform-api";
import { updateBracketMatchResultFirestore } from "../../../../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

async function requireBracketAccess(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };

  if (user.role === "PLATFORM") {
    return { ok: true as const, user, tournament };
  }

  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await checkClientFeatureAccessByUserId({ userId: user.id, feature: "BRACKET" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }
  if (tournament.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }

  return { ok: true as const, user, tournament };
}

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
  const auth = await requireBracketAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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
    actorUserId: auth.user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, bracket: result.bracket });
}
