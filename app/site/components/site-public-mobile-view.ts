/** `SiteChromeHeader`와 서버 레이아웃이 공유 — 클라이언트 전용 모듈에 두지 않는다. */

import { isCaromClubMobileAppShell } from "../../../lib/is-carom-club-mobile-app-shell";

function isMobileUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return ua.includes("iphone") || ua.includes("android") || ua.includes("ipad") || ua.includes("mobile");
}

/** 공개 사이트·클라이언트 PC 헤더 노출 분기와 동일 기준 */
export function isPublicSiteMobileView(headerStore: { get: (name: string) => string | null }): boolean {
  const ua = headerStore.get("user-agent") ?? "";
  if (isMobileUserAgent(ua)) return true;
  if (headerStore.get("sec-ch-ua-mobile") === "?1") return true;
  return false;
}

/** 공개 사이트 래퍼: 모바일 UA·CH 또는 캐롬클럽 앱(WebView 등)이면 모바일 셸 DOM */
export function isPublicSiteMobileShell(headerStore: { get: (name: string) => string | null }): boolean {
  return isPublicSiteMobileView(headerStore) || isCaromClubMobileAppShell(headerStore);
}
