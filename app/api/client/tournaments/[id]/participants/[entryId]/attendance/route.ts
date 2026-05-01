import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../../lib/platform-api";
import { updateParticipantAttendanceChecked } from "../../../../../../../../lib/server/platform-backing-store";
import { assertClientCanManageTournamentFirestore } from "../../../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; entryId: string }> }) {
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

  const { id, entryId } = await context.params;
  const tournamentId = id.trim();
  const eid = entryId.trim();
  if (!tournamentId || !eid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: user.id,
    actorRole: user.role,
    tournamentId,
  });
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.httpStatus });
  }

  let body: { checked?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  if (body.checked !== true && body.checked !== false) {
    return NextResponse.json({ error: "checked 값이 필요합니다." }, { status: 400 });
  }

  const result = await updateParticipantAttendanceChecked({
    tournamentId,
    entryId: eid,
    checked: body.checked,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, application: result.application });
}
