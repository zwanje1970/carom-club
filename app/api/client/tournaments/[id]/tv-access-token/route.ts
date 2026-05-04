import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { AuthRole } from "../../../../../../lib/auth/roles";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById, resolveCanonicalUserIdForAuth } from "../../../../../../lib/platform-api";
import {
  assertClientCanManageTournamentFirestore,
  ensureTournamentTvAccessTokenFirestore,
} from "../../../../../../lib/server/firestore-tournaments";

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

async function actorTournamentUserId(user: { id: string; role: AuthRole }): Promise<string> {
  if (user.role === "PLATFORM") return user.id;
  return resolveCanonicalUserIdForAuth(user.id);
}

function buildTvShareUrl(request: NextRequest, token: string): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? (url.protocol.replace(":", "") || "https");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}/tv/share/${encodeURIComponent(token)}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const actorId = await actorTournamentUserId(auth.user);
  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: actorId,
    actorRole: auth.user.role,
    tournamentId: tid,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.httpStatus });
  }

  const token = gate.tournament.tvAccessToken?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ token: null as string | null, url: null as string | null });
  }
  return NextResponse.json({ token, url: buildTvShareUrl(request, token) });
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

  const actorId = await actorTournamentUserId(auth.user);
  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: actorId,
    actorRole: auth.user.role,
    tournamentId: tid,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.httpStatus });
  }

  const ensured = await ensureTournamentTvAccessTokenFirestore(tid);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }
  return NextResponse.json({ token: ensured.token, url: buildTvShareUrl(request, ensured.token) });
}
