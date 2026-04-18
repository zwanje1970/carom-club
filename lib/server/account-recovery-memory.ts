import { randomUUID } from "crypto";

type ResetHold = {
  userId: string;
  expiresAt: number;
};

const resetTokens = new Map<string, ResetHold>();

const RESET_TTL_MS = 10 * 60 * 1000;

function cleanup(): void {
  const now = Date.now();
  for (const [k, v] of resetTokens) {
    if (v.expiresAt < now) resetTokens.delete(k);
  }
}

/** 아이디+전화번호 검증 후 발급, 완료 API에서 한 번만 소비 */
export function issuePasswordResetToken(userId: string): string {
  cleanup();
  const token = randomUUID();
  resetTokens.set(token, { userId, expiresAt: Date.now() + RESET_TTL_MS });
  return token;
}

/** 소비: 한 번만 유효 */
export function takePasswordResetToken(resetToken: string): { ok: true; userId: string } | { ok: false } {
  cleanup();
  const t = resetTokens.get(resetToken);
  if (!t || t.expiresAt < Date.now()) return { ok: false };
  resetTokens.delete(resetToken);
  return { ok: true, userId: t.userId };
}
