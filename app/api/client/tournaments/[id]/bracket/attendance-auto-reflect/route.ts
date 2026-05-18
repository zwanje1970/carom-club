import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../lib/platform-api";
import { setBracketAttendanceAutoReflectFirestore } from "../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type Body = {
  attendanceAutoReflect?: unknown;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tournamentId = id.trim();
  if (!tournamentId) {
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

  const auth = await authorizeClientTournamentBracketContext({ user, tournamentId });
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
  if (!body || typeof body.attendanceAutoReflect !== "boolean") {
    return NextResponse.json({ error: "attendanceAutoReflect(boolean) 필드가 필요합니다." }, { status: 400 });
  }

  const result = await setBracketAttendanceAutoReflectFirestore({
    tournamentId,
    attendanceAutoReflect: body.attendanceAutoReflect,
    ...(bracketZoneId ? { bracketZoneId } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const, bracket: result.bracket });
}
