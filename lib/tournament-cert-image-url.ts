/**
 * 참가 신청 시 전달된 인증 이미지 URL이 업로드 API로 저장된 경로인지 검사 (SSRF 완화).
 */
export function isTrustedCertificationImageUrl(raw: string): boolean {
  const url = raw.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) return false;
  try {
    const u = new URL(url);
    if (u.username || u.password) return false;
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (u.hostname.endsWith(".public.blob.vercel-storage.com")) return true;
    if (u.pathname.includes("/certification/")) return true;
    if (u.pathname.startsWith("/uploads/")) return true;
    return false;
  } catch {
    return false;
  }
}
