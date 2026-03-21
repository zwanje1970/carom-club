/**
 * 로그인 후 리다이렉트용 — 앱 내부 경로만 허용 (오픈 리다이렉트 방지).
 */
export function safeInternalNextPath(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  if (t.includes("://") || t.includes("\\")) return null;
  if (/[\r\n\u0000]/.test(t)) return null;
  return t;
}
