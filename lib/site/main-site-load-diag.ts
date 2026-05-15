/** 메인 스플래시·카드 로딩 흐름 진단 — 개발 또는 `NEXT_PUBLIC_SITE_MAIN_LOAD_DIAG=1` */
export function isMainSiteLoadDiagEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SITE_MAIN_LOAD_DIAG === "1"
  );
}

export function logMainSiteLoadDiag(
  scope: "splash" | "server" | "client-scroll",
  message: string,
  payload?: Record<string, unknown>,
): void {
  if (!isMainSiteLoadDiagEnabled()) return;
  const ts = typeof performance !== "undefined" ? performance.now() : Date.now();
  console.info(`[site-main-load-diag:${scope}]`, message, { ts, ...payload });
}
