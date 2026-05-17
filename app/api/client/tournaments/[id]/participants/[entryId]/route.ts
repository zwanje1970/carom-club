import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById, resolveCanonicalUserIdForAuth } from "../../../../../../../lib/platform-api";
import {
  getTournamentApplicationByIdFirestore,
  softDeleteTournamentApplicationFirestore,
} from "../../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../../lib/server/firestore-tournaments";
import {
  resolveTournamentZoneClientAccess,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; entryId: string }> }
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

  const { id, entryId } = await context.params;
  if (!id.trim() || !entryId.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const targetEntry = await getTournamentApplicationByIdFirestore(id, entryId);
  if (!targetEntry) {
    return NextResponse.json({ error: "참가신청을 찾을 수 없습니다." }, { status: 404 });
  }

  const isPlatform = user.role === "PLATFORM";
  let canManage = isPlatform;
  if (!canManage && user.role === "CLIENT") {
    const actorId = await resolveCanonicalUserIdForAuth(user.id);
    if (tournament.createdBy === actorId || tournament.createdBy === user.id.trim()) {
      const clientStatus = await getClientStatusByUserId(user.id);
      canManage = clientStatus === "APPROVED";
    } else if (tournament.zonesEnabled === true) {
      const access = await resolveTournamentZoneClientAccess({ user, tournamentId: id });
      if (access.ok && access.access.kind === "zone_manager") {
        if (!zoneManagerMayAccessZoneId(access.access, targetEntry.zoneId ?? undefined)) {
          return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
        }
        canManage = true;
      }
    }
  }

  if (!canManage) {
    return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 });
  }

  const result = await softDeleteTournamentApplicationFirestore({ tournamentId: id, entryId });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const });
}
