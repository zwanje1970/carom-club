import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById, resolveCanonicalUserIdForAuth } from "../../../../../../../../lib/platform-api";
import {
  getTournamentApplicationByIdFirestore,
  patchTournamentApplicationProcessingFirestore,
} from "../../../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../../../lib/server/firestore-tournaments";
import {
  resolveTournamentZoneClientAccess,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
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
    return NextResponse.json({ error: "상태 변경 권한이 없습니다." }, { status: 403 });
  }

  let body: { depositConfirmed?: unknown; applicationApproved?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const dc = body.depositConfirmed;
  const aa = body.applicationApproved;
  const hasDc = typeof dc === "boolean";
  const hasAa = typeof aa === "boolean";
  if ((hasDc && hasAa) || (!hasDc && !hasAa)) {
    return NextResponse.json({ error: "depositConfirmed 또는 applicationApproved 중 하나만 보내 주세요." }, { status: 400 });
  }

  const result = await patchTournamentApplicationProcessingFirestore({
    tournamentId: id,
    entryId,
    ...(hasDc ? { depositConfirmed: dc } : {}),
    ...(hasAa ? { applicationApproved: aa } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const, application: result.application });
}
