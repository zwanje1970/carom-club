import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../lib/platform-api";
import { createTournamentApplicationFirestore } from "../../../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { triggerOcrForTournamentApplication } from "../../../../../../lib/server/ocr-service";
import { getProofImageAssetById, resolveCanonicalUserIdForAuth } from "../../../../../../lib/server/platform-backing-store";
import { evaluateSiteApplyOcrGate } from "../../../../../../lib/server/site-apply-ocr-gate";

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
    affiliation?: unknown;
    handicap?: unknown;
    participantAverage?: unknown;
    proofImageId?: unknown;
    proofImage320Url?: unknown;
    proofImage640Url?: unknown;
    proofOriginalUrl?: unknown;
    waitlist?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const proofImageId = typeof body.proofImageId === "string" ? body.proofImageId.trim() : "";
  const bodyAffiliation = typeof body.affiliation === "string" ? body.affiliation : "";
  const bodyHandicap =
    typeof body.handicap === "number" && Number.isFinite(body.handicap)
      ? body.handicap
      : typeof body.handicap === "string" && body.handicap.trim() !== "" && Number.isFinite(Number(body.handicap))
        ? Number(body.handicap)
        : null;
  const bodyParticipantAverage =
    typeof body.participantAverage === "number" && Number.isFinite(body.participantAverage)
      ? body.participantAverage
      : typeof body.participantAverage === "string" &&
          body.participantAverage.trim() !== "" &&
          Number.isFinite(Number(body.participantAverage))
        ? Number(body.participantAverage)
        : null;

  let gateResult:
    | { ok: boolean; userMessage: string; handicap: number | null; average: number | null }
    | null = null;
  if (proofImageId) {
    const canonicalUserId = await resolveCanonicalUserIdForAuth(user.id);
    const proofImage = await getProofImageAssetById(proofImageId);
    if (!proofImage) {
      return NextResponse.json({ error: "증빙 이미지를 다시 업로드해 주세요." }, { status: 400 });
    }
    if (proofImage.uploaderUserId !== canonicalUserId) {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }
    const gate = await evaluateSiteApplyOcrGate({
      proofImage,
      rule: tournament.rule,
      mockOcrSeed: {
        depositorName: typeof body.depositorName === "string" ? body.depositorName : "",
        phone: typeof body.phone === "string" ? body.phone : "",
      },
      applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
      applicantPhone: typeof body.phone === "string" ? body.phone : "",
    });
    gateResult = gate;
    if (!gate.ok) {
      return NextResponse.json({ error: gate.userMessage }, { status: 400 });
    }
    if (tournament.rule.verificationMode === "AUTO") {
      if (gate.handicap == null || gate.average == null) {
        return NextResponse.json({ error: gate.userMessage || "판독불가, 재업로드 요망" }, { status: 400 });
      }
    }
  }

  const finalHandicap =
    tournament.rule.verificationMode === "AUTO"
      ? (gateResult?.handicap ?? null)
      : bodyHandicap;
  const finalParticipantAverage =
    tournament.rule.verificationMode === "AUTO"
      ? (gateResult?.average ?? null)
      : bodyParticipantAverage;

  const result = await createTournamentApplicationFirestore({
    tournamentId: id,
    userId: user.id,
    applicantName: typeof body.applicantName === "string" ? body.applicantName : "",
    phone: typeof body.phone === "string" ? body.phone : "",
    depositorName: typeof body.depositorName === "string" ? body.depositorName : "",
    affiliation: bodyAffiliation,
    handicap: finalHandicap ?? undefined,
    participantAverage: finalParticipantAverage ?? undefined,
    proofImageId: typeof body.proofImageId === "string" ? body.proofImageId : "",
    proofImage320Url: typeof body.proofImage320Url === "string" ? body.proofImage320Url : "",
    proofImage640Url: typeof body.proofImage640Url === "string" ? body.proofImage640Url : "",
    proofOriginalUrl: typeof body.proofOriginalUrl === "string" ? body.proofOriginalUrl : "",
    waitlist: body.waitlist === true,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (result.application.proofImageId.trim() !== "") {
    triggerOcrForTournamentApplication({
      tournamentId: id,
      entryId: result.application.id,
    });
  }

  return NextResponse.json({
    ok: true,
    application: result.application,
  });
}
