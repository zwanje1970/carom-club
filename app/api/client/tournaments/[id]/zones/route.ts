import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../lib/platform-api";
import { resolveTournamentZoneClientAccess } from "../../../../../../lib/server/tournament-zone-access";
import { createTournamentZone, listTournamentZones } from "../../../../../../lib/server/firestore-tournament-zones";

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

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 });
  }

  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const resolved = await resolveTournamentZoneClientAccess({ user: auth.user, tournamentId: tid });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.httpStatus });
  }

  const blocked = zonesEnabledOr403(resolved.tournament);
  if (blocked) return blocked;

  const zones = await listTournamentZones(tid);
  const access = resolved.access;
  let out = zones;
  if (access.kind === "zone_manager") {
    out = zones.filter((z) => access.managedZoneIds.includes(z.id));
  }
  return NextResponse.json({ zones: out });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근할 수 없습니다." }, { status: 403 });
  }

  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const resolved = await resolveTournamentZoneClientAccess({ user: auth.user, tournamentId: tid });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.httpStatus });
  }
  if (resolved.access.kind !== "full") {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const blocked = zonesEnabledOr403(resolved.tournament);
  if (blocked) return blocked;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const zoneName = typeof body.zoneName === "string" ? body.zoneName : "";
  const zoneCode = body.zoneCode;
  const sortOrder = body.sortOrder;
  const zoneManagerUserIds = body.zoneManagerUserIds;

  try {
    const zone = await createTournamentZone({
      tournamentId: tid,
      zoneName,
      zoneCode: zoneCode === undefined ? undefined : zoneCode === null ? null : String(zoneCode),
      sortOrder: typeof sortOrder === "number" ? sortOrder : typeof sortOrder === "string" && sortOrder.trim() !== "" ? Number(sortOrder) : undefined,
      zoneManagerUserIds: Array.isArray(zoneManagerUserIds)
        ? zoneManagerUserIds.filter((x): x is string => typeof x === "string")
        : undefined,
    });
    return NextResponse.json({ zone });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "권역을 만들 수 없습니다.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
