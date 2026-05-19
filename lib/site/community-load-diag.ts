/** 커뮤니티 로딩 진단 — 개발 또는 `NEXT_PUBLIC_COMMUNITY_LOAD_DIAG=1` (커뮤니티 라우트에서만 import) */
export function isCommunityLoadDiagEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_COMMUNITY_LOAD_DIAG === "1"
  );
}

const COMMUNITY_LIST_LOAD_DIAG_PREFIX = "[community-load-diag]";

let listRouteEnterPerfMs: number | null = null;
let listLastLogPerfMs: number | null = null;

export function resetCommunityListLoadDiagRouteEnter(): void {
  if (!isCommunityLoadDiagEnabled()) return;
  if (typeof performance === "undefined") return;
  listRouteEnterPerfMs = performance.now();
  listLastLogPerfMs = listRouteEnterPerfMs;
}

export function logCommunityListLoadDiagPhase(
  phase: string,
  extra?: Record<string, unknown>,
): void {
  if (!isCommunityLoadDiagEnabled()) return;
  if (typeof performance === "undefined") return;
  const now = performance.now();
  const enter = listRouteEnterPerfMs ?? now;
  if (listRouteEnterPerfMs == null) {
    listRouteEnterPerfMs = now;
    listLastLogPerfMs = now;
  }
  const elapsedMs = Math.round((now - enter) * 100) / 100;
  const deltaMs =
    listLastLogPerfMs != null ? Math.round((now - listLastLogPerfMs) * 100) / 100 : 0;
  listLastLogPerfMs = now;
  console.log(COMMUNITY_LIST_LOAD_DIAG_PREFIX, phase, { elapsedMs, deltaMs, ...extra });
}

/** RSC 목록 페이지 — 서버 구간 elapsedMs(페이지 함수 진입 기준) */
export function createCommunityListLoadDiagServerLogger(routeLabel: string) {
  const pageStart = typeof performance !== "undefined" ? performance.now() : 0;
  let last = pageStart;
  const log = (phase: string, extra?: Record<string, unknown>) => {
    if (!isCommunityLoadDiagEnabled()) return;
    if (typeof performance === "undefined") return;
    const now = performance.now();
    const elapsedMs = Math.round((now - pageStart) * 100) / 100;
    const deltaMs = Math.round((now - last) * 100) / 100;
    last = now;
    console.log(COMMUNITY_LIST_LOAD_DIAG_PREFIX, phase, {
      elapsedMs,
      deltaMs,
      origin: "server",
      route: routeLabel,
      ...extra,
    });
  };
  return { log };
}

let detailEnterMs: number | null = null;
let detailEnterPostId: string | null = null;
let bodyReady = false;
let commentsReady = false;
let loadingCompleteLogged = false;

export function resetCommunityLoadDiagSession(postId: string): void {
  detailEnterMs = performance.now();
  detailEnterPostId = postId;
  bodyReady = false;
  commentsReady = false;
  loadingCompleteLogged = false;
}

export function markCommunityLoadDiagBodyReady(): void {
  bodyReady = true;
  tryLogCommunityLoadDiagLoadingComplete();
}

export function markCommunityLoadDiagCommentsReady(): void {
  commentsReady = true;
  tryLogCommunityLoadDiagLoadingComplete();
}

export function tryLogCommunityLoadDiagLoadingComplete(): void {
  if (!isCommunityLoadDiagEnabled()) return;
  if (loadingCompleteLogged) return;
  if (!bodyReady || !commentsReady) return;
  if (detailEnterMs == null) return;
  loadingCompleteLogged = true;
  console.log("[community-load-diag]", "loading complete", {
    totalDurationMs: performance.now() - detailEnterMs,
    postId: detailEnterPostId,
  });
}

export function logCommunityLoadDiagFetchStart(kind: "config" | "post" | "comments"): void {
  if (!isCommunityLoadDiagEnabled()) return;
  console.log("[community-load-diag]", `${kind} fetch start`);
}

export function logCommunityLoadDiagFetchComplete(
  kind: "config" | "post" | "comments",
  payload: Record<string, unknown>,
): void {
  if (!isCommunityLoadDiagEnabled()) return;
  console.log("[community-load-diag]", `${kind} fetch complete`, payload);
}

export function logCommunityLoadDiagDetailEnter(postId: string): void {
  if (!isCommunityLoadDiagEnabled()) return;
  resetCommunityLoadDiagSession(postId);
  console.log("[community-load-diag]", "detail enter", {
    postId,
    enterMs: detailEnterMs,
    timestamp: Date.now(),
  });
}
