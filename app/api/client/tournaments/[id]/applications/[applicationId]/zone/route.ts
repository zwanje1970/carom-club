import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../../lib/platform-api";
import {
  getTournamentApplicationByIdFirestore,
  updateTournamentApplicationZoneIdFirestore,
} from "../../../../../../../../lib/server/firestore-tournament-applications";
import {
  canManageTournamentZone,
  resolveTournamentZoneClientAccess,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
} from "../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; applicationId: string }> }
) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (user.role === "CLIENT") {
    const clientStatus = await getClientStatusByUserId(user.id);
    if (clientStatus !== "APPROVED") {
      return NextResponse.json({ error: "클라이언트 승인 후 이용할 수 있습니다." }, { status: 403 });
    }
  } else if (user.role !== "PLATFORM") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id, applicationId } = await context.params;
  const tournamentId = id.trim();
  const entryId = applicationId.trim();
  if (!tournamentId || !entryId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const access = await resolveTournamentZoneClientAccess({ user, tournamentId });
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.httpStatus });
  }

  if (access.tournament.zonesEnabled !== true) {
    return NextResponse.json({ error: "권역 운영이 비활성화되어 있습니다." }, { status: 403 });
  }

  const entry = await getTournamentApplicationByIdFirestore(tournamentId, entryId);
  if (!entry) {
    return NextResponse.json({ error: "참가신청을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: { zoneId?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (!("zoneId" in body)) {
    return NextResponse.json({ error: "zoneId 값이 필요합니다." }, { status: 400 });
  }

  let zoneId: string | null;
  if (body.zoneId === null) {
    zoneId = null;
  } else if (typeof body.zoneId === "string") {
    const t = body.zoneId.trim();
    zoneId = t === "" ? null : t;
  } else {
    return NextResponse.json({ error: "zoneId 값이 올바르지 않습니다." }, { status: 400 });
  }

  if (access.access.kind === "zone_manager") {
    const oldZ = typeof entry.zoneId === "string" ? entry.zoneId.trim() : "";
    if (zoneId === null) {
      if (!oldZ || !access.access.managedZoneIds.includes(oldZ)) {
        return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
      }
    } else {
      const okNew = await canManageTournamentZone({
        userId: user.id,
        userRole: user.role,
        tournamentId,
        zoneId,
      });
      if (!okNew) {
        return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
      }
      if (oldZ && oldZ !== zoneId) {
        const okOld = await canManageTournamentZone({
          userId: user.id,
          userRole: user.role,
          tournamentId,
          zoneId: oldZ,
        });
        if (!okOld) {
          return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
        }
      }
    }
  }

  const result = await updateTournamentApplicationZoneIdFirestore({
    tournamentId,
    entryId,
    zoneId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const, zoneId });
}
