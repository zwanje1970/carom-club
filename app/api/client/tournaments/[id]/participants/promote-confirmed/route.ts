import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById, resolveCanonicalUserIdForAuth } from "../../../../../../../lib/platform-api";
import { promoteOperatorApprovedApplicationsFirestore } from "../../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../../lib/server/firestore-tournaments";
import { resolveTournamentZoneClientAccess } from "../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { id } = await context.params;
  const tournamentId = id.trim();
  if (!tournamentId) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const isPlatform = user.role === "PLATFORM";
  let zoneIdsFilter: string[] | null = null;

  if (isPlatform) {
    zoneIdsFilter = null;
  } else if (user.role === "CLIENT") {
    const actorId = await resolveCanonicalUserIdForAuth(user.id);
    if (tournament.createdBy === actorId || tournament.createdBy === user.id.trim()) {
      const clientStatus = await getClientStatusByUserId(user.id);
      if (clientStatus !== "APPROVED") {
        return NextResponse.json({ error: "클라이언트 승인 후 이용할 수 있습니다." }, { status: 403 });
      }
      zoneIdsFilter = null;
    } else {
      const access = await resolveTournamentZoneClientAccess({ user, tournamentId });
      if (!access.ok) {
        return NextResponse.json({ error: access.error }, { status: access.httpStatus });
      }
      if (access.access.kind === "zone_manager") {
        zoneIdsFilter = access.access.managedZoneIds;
      } else {
        zoneIdsFilter = null;
      }
    }
  } else {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const result = await promoteOperatorApprovedApplicationsFirestore({
    tournamentId,
    zoneIdsFilter,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true as const, promoted: result.promoted });
}
