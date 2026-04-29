/**
 * 앱(WebView·네이티브 래핑 등) 요청인지 판별한다. 플랫폼 관리 UI/API는 웹 브라우저 전용으로 두기 위해 사용한다.
 *
 * - `CAROM_CLUB_MOBILE_APP=1` 또는 `IS_MOBILE_APP=1` (서버 환경)
 * - 요청 헤더 `x-carom-club-mobile-app: 1` (클라이언트가 붙이면 신뢰)
 * - User-Agent: Android WebView(`; wv)` 패턴), 또는 관례 문자열(caromclubapp 등)
 *
 * 일반 모바일 브라우저(Chrome/Safari)만으로는 true가 되지 않도록 UA는 보수적으로만 본다.
 */
export const CAROM_CLUB_MOBILE_APP_HEADER = "x-carom-club-mobile-app";

export type HeaderBag = { get(name: string): string | null };

export function isCaromClubMobileAppShell(headers: HeaderBag): boolean {
  if (process.env.CAROM_CLUB_MOBILE_APP === "1" || process.env.IS_MOBILE_APP === "1") {
    return true;
  }
  const marker = headers.get(CAROM_CLUB_MOBILE_APP_HEADER);
  if (marker === "1" || marker?.toLowerCase() === "true") {
    return true;
  }
  const ua = (headers.get("user-agent") ?? "").toLowerCase();
  if (ua.includes("; wv)") || ua.includes("; wv ")) {
    return true;
  }
  if (ua.includes("caromclubapp") || ua.includes("carom-club-app")) {
    return true;
  }
  return false;
}
