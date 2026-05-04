import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { getUserById } from "../../../../../../../lib/platform-api";
import { getTournamentByIdFirestore } from "../../../../../../../lib/server/firestore-tournaments";
import { evaluateSiteApplyOcrGate } from "../../../../../../../lib/server/site-apply-ocr-gate";
import { getProofImageAssetById, resolveCanonicalUserIdForAuth } from "../../../../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다.", ok: false }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다.", ok: false }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id.trim()) {
    return NextResponse.json({ error: "잘못된 요청입니다.", ok: false }, { status: 400 });
  }

  let body: {
    proofImageId?: unknown;
    depositorName?: unknown;
    phone?: unknown;
  } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다.", ok: false }, { status: 400 });
  }

  const proofImageId = typeof body.proofImageId === "string" ? body.proofImageId.trim() : "";
  if (!proofImageId) {
    return NextResponse.json({ error: "증빙 이미지를 업로드해 주세요.", ok: false }, { status: 400 });
  }

  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다.", ok: false }, { status: 404 });
  }

  const canonicalUserId = await resolveCanonicalUserIdForAuth(user.id);
  const proofImage = await getProofImageAssetById(proofImageId);
  if (!proofImage) {
    return NextResponse.json({ error: "증빙 이미지를 다시 업로드해 주세요.", ok: false }, { status: 400 });
  }
  if (proofImage.uploaderUserId !== canonicalUserId) {
    return NextResponse.json({ error: "잘못된 요청입니다.", ok: false }, { status: 400 });
  }

  const depositorName = typeof body.depositorName === "string" ? body.depositorName : "";
  const phone = typeof body.phone === "string" ? body.phone : "";

  const gate = await evaluateSiteApplyOcrGate({
    proofImage,
    rule: tournament.rule,
    mockOcrSeed: { depositorName, phone },
  });

  return NextResponse.json({
    ok: gate.ok,
    userMessage: gate.userMessage,
  });
}
