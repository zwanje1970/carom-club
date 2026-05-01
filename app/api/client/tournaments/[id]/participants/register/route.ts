import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../../../../lib/platform-api";
import { createAdminRegisteredParticipant } from "../../../../../../../lib/server/platform-backing-store";
import { assertClientCanManageTournamentFirestore } from "../../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const tournamentId = id.trim();
  if (!tournamentId) {
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

  let body: {
    applicantName?: unknown;
    participantAverage?: unknown;
    phone?: unknown;
    adminNote?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const applicantName = typeof body.applicantName === "string" ? body.applicantName : "";
  const participantAverage =
    typeof body.participantAverage === "number"
      ? body.participantAverage
      : typeof body.participantAverage === "string"
        ? Number(body.participantAverage.trim())
        : NaN;
  const phone = typeof body.phone === "string" ? body.phone : "";
  const adminNote = typeof body.adminNote === "string" ? body.adminNote : "";

  const result = await createAdminRegisteredParticipant({
    tournamentId,
    applicantName,
    participantAverage,
    phone,
    adminNote,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, application: result.application });
}
