import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../lib/platform-api";
import {
  resolveTournamentZoneClientAccess,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
} from "../../../../../../../lib/server/tournament-zone-access";
import { updateTournamentZone } from "../../../../../../../lib/server/firestore-tournament-zones";

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

function zonesEnabledOr403(tournament: { zonesEnabled?: boolean }) {
  if (tournament.zonesEnabled !== true) {
    return NextResponse.json({ error: "권역 운영이 비활성화되어 있습니다." }, { status: 403 });
  }
  return null;
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; zoneId: string }> }) {
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

  const resolved = await resolveTournamentZoneClientAccess({ user: auth.user, tournamentId: tid });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.httpStatus });
  }

  const blocked = zonesEnabledOr403(resolved.tournament);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const hasZoneName = typeof body.zoneName === "string";
  const hasZoneCode = "zoneCode" in body;
  const hasSort = typeof body.sortOrder === "number" || (typeof body.sortOrder === "string" && String(body.sortOrder).trim() !== "");
  const hasManagers = "zoneManagerUserIds" in body;
  const hasStatus = body.status === "ACTIVE" || body.status === "INACTIVE";

  if (!hasZoneName && !hasZoneCode && !hasSort && !hasManagers && !hasStatus) {
    return NextResponse.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
  }

  if (resolved.access.kind === "zone_manager") {
    if (!resolved.access.managedZoneIds.includes(zid)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
    if (hasManagers || hasStatus) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
  }

  const sortOrderParsed =
    typeof body.sortOrder === "number"
      ? body.sortOrder
      : typeof body.sortOrder === "string" && body.sortOrder.trim() !== ""
        ? Number(body.sortOrder)
        : undefined;

  const zoneManagerUserIds = Array.isArray(body.zoneManagerUserIds)
    ? body.zoneManagerUserIds.filter((x): x is string => typeof x === "string")
    : undefined;

  const updated = await updateTournamentZone({
    tournamentId: tid,
    id: zid,
    ...(hasZoneName ? { zoneName: body.zoneName as string } : {}),
    ...(hasZoneCode
      ? {
          zoneCode:
            body.zoneCode === null
              ? null
              : typeof body.zoneCode === "string"
                ? body.zoneCode
                : null,
        }
      : {}),
    ...(hasSort && sortOrderParsed !== undefined && Number.isFinite(sortOrderParsed)
      ? { sortOrder: Math.floor(sortOrderParsed) }
      : {}),
    ...(hasManagers ? { zoneManagerUserIds } : {}),
    ...(hasStatus ? { status: body.status as "ACTIVE" | "INACTIVE" } : {}),
  });

  if (!updated) {
    return NextResponse.json({ error: "권역을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ zone: updated });
}
