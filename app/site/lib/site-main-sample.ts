/**
 * `/site/main-sample` 전용 실험 셸 — 하단 네비 4배 토큰·헤더 숨김 등.
 * 정식 메인(`/`, `/site`)은 일반 페이지와 동일한 `--site-fixed-bottom-nav-layout-height` 를 쓴다.
 */
export function isSiteMainSamplePathname(pathname: string): boolean {
  const p = (pathname.split("?")[0] ?? pathname).trim();
  if (!p) return false;
  return p === "/site/main-sample" || p.startsWith("/site/main-sample/");
}
