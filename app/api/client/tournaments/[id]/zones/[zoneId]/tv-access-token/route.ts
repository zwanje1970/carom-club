import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../../lib/platform-api";
import { ensureTournamentZoneTvAccessTokenFirestore } from "../../../../../../../../lib/server/firestore-tournament-zones";
import { getTournamentByIdFirestore } from "../../../../../../../../lib/server/firestore-tournaments";
import {
  canManageTournamentZone,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
} from "../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const };
  }

  return { user, allowed: true as const };
}

function buildTvShareZoneUrl(request: NextRequest, token: string): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? (url.protocol.replace(":", "") || "https");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/tv/share/zones/${encodeURIComponent(token)}`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string; zoneId: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 });
  }

  const { id, zoneId } = await context.params;
  const tid = id.trim();
  const zid = zoneId.trim();
  if (!tid || !zid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }
  if (tournament.zonesEnabled !== true) {
    return NextResponse.json({ error: "권역 운영이 비활성화되어 있습니다." }, { status: 403 });
  }

  const may = await canManageTournamentZone({
    userId: auth.user.id,
    userRole: auth.user.role,
    tournamentId: tid,
    zoneId: zid,
  });
  if (!may) {
    return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
  }

  const ensured = await ensureTournamentZoneTvAccessTokenFirestore(tid, zid);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: ensured.error === "권역을 찾을 수 없습니다." ? 404 : 500 });
  }
  return NextResponse.json({ token: ensured.token, url: buildTvShareZoneUrl(request, ensured.token) });
}
