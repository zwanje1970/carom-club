import { NextResponse } from "next/server";
import { findUserByLoginIdAndPhone } from "../../../../../lib/platform-api";
import { issuePasswordResetToken } from "../../../../../lib/server/account-recovery-memory";
import { checkRateLimit, getRequestClientKey } from "../../../../../lib/server/rate-limit-memory";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 15;

export async function POST(request: Request) {
  const clientKey = getRequestClientKey(request);
  if (!checkRateLimit(`auth-recovery-start:${clientKey}`, MAX_PER_WINDOW, WINDOW_MS)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let body: { loginId?: unknown; phone?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청이 올바르지 않습니다." }, { status: 400 });
  }

  const loginId = typeof body.loginId === "string" ? body.loginId : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  if (!loginId.trim() || !phone.trim()) {
    return NextResponse.json({ error: "아이디와 전화번호를 입력해 주세요." }, { status: 400 });
  }

  const user = await findUserByLoginIdAndPhone(loginId, phone);
  if (!user) {
    return NextResponse.json({ error: "정보 없음" }, { status: 404 });
  }

  const resetToken = issuePasswordResetToken(user.id);
  return NextResponse.json({ ok: true, resetToken });
}
