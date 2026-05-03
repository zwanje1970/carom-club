import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../lib/platform-api";
import { assertClientCanManageTournamentFirestore } from "../../../../../../../lib/server/firestore-tournaments";
import { listTournamentApplicationsListItemsByTournamentIdFirestore } from "../../../../../../../lib/server/firestore-tournament-applications";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ ok: false as const, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ ok: false as const, error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  if (user.role === "CLIENT") {
    const clientStatus = await getClientStatusByUserId(user.id);
    if (clientStatus !== "APPROVED") {
      return NextResponse.json({ ok: false as const, error: "클라이언트 승인 후 이용할 수 있습니다." }, { status: 403 });
    }
  } else if (user.role !== "PLATFORM") {
    return NextResponse.json({ ok: false as const, error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await context.params;
  const tournamentId = id.trim();
  if (!tournamentId) {
    return NextResponse.json({ ok: false as const, error: "잘못된 요청입니다." }, { status: 400 });
  }

  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: user.id,
    actorRole: user.role,
    tournamentId,
  });
  if (!gate.ok) {
    return NextResponse.json({ ok: false as const, error: gate.error }, { status: gate.httpStatus });
  }

  try {
    const entries = await listTournamentApplicationsListItemsByTournamentIdFirestore(tournamentId);
    return NextResponse.json({ ok: true as const, entries });
  } catch (e) {
    console.error("[api/client/tournaments/.../applications/list-items]", e);
    return NextResponse.json({ ok: false as const, error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
