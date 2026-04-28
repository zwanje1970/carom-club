/**
 * 캐러셀형 정식 메인 — 오버레이 헤더·하단 네비 실험 스타일 분기.
 * (`/`·`/site` 정식 메인 + 구 샘플 경로 리다이렉트 전 북마크)
 */
export function isSiteMainSamplePathname(pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? pathname).trim();
  if (!p) return false;
  if (p === "/" || p === "/site") return true;
  return p === "/site/main-sample" || p.startsWith("/site/main-sample/");
}
