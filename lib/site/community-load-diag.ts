/** 커뮤니티 상세 로딩 진단 — 개발 또는 `NEXT_PUBLIC_COMMUNITY_LOAD_DIAG=1` */
export function isCommunityLoadDiagEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_COMMUNITY_LOAD_DIAG === "1"
  );
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
