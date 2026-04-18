import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  duplicateTournament,
  getClientStatusByUserId,
  getUserById,
} from "../../../../../../lib/server/dev-store";

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
    return { user, allowed: false as const, reason: "client-role-required" as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const, reason: "client-not-approved" as const };
  }

  return { user, allowed: true as const };
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다.", reason: auth.reason }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await duplicateTournament({
    sourceTournamentId: id,
    actorUserId: auth.user.id,
    actorRole: auth.user.role,
  });

  if (!result.ok) {
    const status = result.httpStatus ?? 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, tournament: result.tournament });
}
