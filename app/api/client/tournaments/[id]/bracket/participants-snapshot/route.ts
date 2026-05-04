import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../lib/platform-api";
import {
  createBracketParticipantSnapshotFirestore,
  getLatestBracketParticipantSnapshotByTournamentIdFirestore,
} from "../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const zoneParam = request.nextUrl.searchParams.get("zoneId")?.trim() ?? "";
  let snapshot: Awaited<ReturnType<typeof getLatestBracketParticipantSnapshotByTournamentIdFirestore>> = null;
  if (auth.tournament.zonesEnabled === true && zoneParam) {
    if (auth.access.kind === "zone_manager" && !zoneManagerMayAccessZoneId(auth.access, zoneParam)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
    snapshot = await getLatestBracketParticipantSnapshotByTournamentIdFirestore(id, { zoneId: zoneParam });
  } else {
    if (auth.access.kind === "zone_manager" && auth.tournament.zonesEnabled === true) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
    snapshot = await getLatestBracketParticipantSnapshotByTournamentIdFirestore(id);
  }
  return NextResponse.json({ snapshot: snapshot ?? null });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
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

  const body = (await request.json().catch(() => null)) as { zoneId?: unknown } | null;
  const zoneId =
    body && typeof body === "object" && typeof body.zoneId === "string" ? body.zoneId.trim() : "";

  if (auth.tournament.zonesEnabled === true && zoneId) {
    if (auth.access.kind === "zone_manager" && !zoneManagerMayAccessZoneId(auth.access, zoneId)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
  }

  const result = await createBracketParticipantSnapshotFirestore({
    tournamentId: id,
    ...(zoneId ? { zoneId } : {}),
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}
