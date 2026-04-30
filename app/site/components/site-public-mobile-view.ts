/** `SiteChromeHeader`와 서버 레이아웃이 공유 — 클라이언트 전용 모듈에 두지 않는다. */

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
