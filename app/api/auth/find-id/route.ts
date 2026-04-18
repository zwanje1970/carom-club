import { NextResponse } from "next/server";
import { findUserByPhone, maskLoginIdForDisplay } from "../../../../lib/server/dev-store";
import { checkRateLimit, getRequestClientKey } from "../../../../lib/server/rate-limit-memory";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 15;

export async function POST(request: Request) {
  const clientKey = getRequestClientKey(request);
  if (!checkRateLimit(`auth-find-id:${clientKey}`, MAX_PER_WINDOW, WINDOW_MS)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let body: { phone?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청이 올바르지 않습니다." }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  if (!phone.trim()) {
    return NextResponse.json({ error: "전화번호를 입력해 주세요." }, { status: 400 });
  }

  const user = await findUserByPhone(phone);
  if (!user) {
    return NextResponse.json({ ok: false, error: "정보 없음" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    maskedLoginId: maskLoginIdForDisplay(user.loginId),
  });
}
