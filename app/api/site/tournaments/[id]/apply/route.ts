import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../lib/server/dev-store";
import { createTournamentApplicationFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { triggerOcrForTournamentApplication } from "../../../../../../lib/server/ocr-service";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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

  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  let body: {
    applicantName?: unknown;
    phone?: unknown;
    depositorName?: unknown;
    proofImageId?: unknown;
    proofImage320Url?: unknown;
    proofImage640Url?: unknown;
    proofOriginalUrl?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const result = await createTournamentApplicationFirestore({
    tournamentId: id,
    userId: user.id,
    applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    depositorName: typeof body.depositorName === "string" ? body.depositorName : "",
    proofImageId: typeof body.proofImageId === "string" ? body.proofImageId : "",
    proofImage320Url: typeof body.proofImage320Url === "string" ? body.proofImage320Url : "",
    proofImage640Url: typeof body.proofImage640Url === "string" ? body.proofImage640Url : "",
    proofOriginalUrl: typeof body.proofOriginalUrl === "string" ? body.proofOriginalUrl : "",
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // OCR은 비동기로 시작하고 신청 응답은 즉시 반환한다.
  triggerOcrForTournamentApplication({
    tournamentId: id,
    entryId: result.application.id,
  });

  return NextResponse.json({
    ok: true,
    application: result.application,
  });
}
