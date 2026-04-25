import { NextResponse } from "next/server";
import { takePasswordResetToken } from "../../../../../lib/server/account-recovery-memory";
import { updateUserPasswordByUserId } from "../../../../../lib/platform-api";
import { checkRateLimit, getRequestClientKey } from "../../../../../lib/server/rate-limit-memory";

export const runtime = "nodejs";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 15;

const MIN_PASSWORD_LEN = 4;

export async function POST(request: Request) {
  const clientKey = getRequestClientKey(request);
  if (!checkRateLimit(`auth-recovery-complete:${clientKey}`, MAX_PER_WINDOW, WINDOW_MS)) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  let body: { resetToken?: unknown; newPassword?: unknown; newPassword2?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청이 올바르지 않습니다." }, { status: 400 });
  }

  const resetToken = typeof body.resetToken === "string" ? body.resetToken.trim() : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const newPassword2 = typeof body.newPassword2 === "string" ? body.newPassword2 : "";
  if (!resetToken || !newPassword || !newPassword2) {
    return NextResponse.json({ error: "비밀번호를 입력해 주세요." }, { status: 400 });
  }
  if (newPassword !== newPassword2) {
    return NextResponse.json({ error: "실패" }, { status: 400 });
  }
  if (newPassword.trim().length < MIN_PASSWORD_LEN) {
    return NextResponse.json({ error: "실패" }, { status: 400 });
  }

  const taken = takePasswordResetToken(resetToken);
  if (!taken.ok) {
    return NextResponse.json({ error: "실패" }, { status: 400 });
  }

  const updated = await updateUserPasswordByUserId(taken.userId, newPassword);
  if (!updated) {
    return NextResponse.json({ error: "실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
