import { isMainSiteLoadDiagEnabled } from "./main-site-load-diag";

const APP_START_KEY = "site-main-preload-app-start-ms";

export function markMainPreloadAppStart(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(APP_START_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function getMainPreloadElapsedMs(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(APP_START_KEY);
    if (!raw) return 0;
    const start = Number(raw);
    if (!Number.isFinite(start)) return 0;
    return Math.round(Date.now() - start);
  } catch {
    return 0;
  }
}

let mainCardImageDiagAnchorPerfMs: number | null = null;

/** pageshow·session-restore kick 등 구간별 상대 시각 기준점 */
export function markMainCardImageDiagAnchor(): void {
  if (typeof performance === "undefined") return;
  mainCardImageDiagAnchorPerfMs = performance.now();
}

export function getMainCardImageDiagRelativeMs(): number {
  if (mainCardImageDiagAnchorPerfMs === null || typeof performance === "undefined") return 0;
  return Math.round(performance.now() - mainCardImageDiagAnchorPerfMs);
}

function logTagged(tag: "main-preload" | "main-card-image", fields: Record<string, string | number | boolean | null | undefined>) {
  if (!isMainSiteLoadDiagEnabled()) return;
  const parts = [`[${tag}]`];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    parts.push(`${key}=${value}`);
  }
  console.info(...parts);
}

export function logMainPreload(
  phase:
    | "splash-preload-start"
    | "splash-img-loaded"
    | "splash-img-decoded"
    | "splash-preload-fail"
    | "splash-preload-timeout"
    | "splash-priority-images-selected"
    | "splash-priority-image-loaded"
    | "splash-priority-image-decoded"
    | "splash-priority-images-ready",
  payload: {
    url?: string;
    urls?: string;
    count?: number;
    readyCount?: number;
    requestedCount?: number;
    elapsedMs?: number;
  },
): void {
  logTagged("main-preload", {
    phase,
    url: payload.url ?? "",
    urls: payload.urls ?? "",
    count: payload.count,
    readyCount: payload.readyCount,
    requestedCount: payload.requestedCount,
    elapsedMs: payload.elapsedMs ?? getMainPreloadElapsedMs(),
  });
}

export function logMainCardImage(
  phase:
    | "main-src-assigned"
    | "main-img-mounted"
    | "main-img-src-set"
    | "main-img-loaded"
    | "main-img-decode-start"
    | "main-img-decoded"
    | "main-img-decode-error"
    | "main-img-visible"
    | "load-target-count"
    | "pageshow-kick-start"
    | "pageshow-kick-done"
    | "session-restore-kick-start"
    | "session-restore-kick-done"
    | "kick-visible-images",
  payload: {
    id?: string;
    url?: string;
    elapsedMs?: number;
    relativeMs?: number;
    visibleOrNearCount?: number;
    totalRenderedCount?: number;
    totalDeckItems?: number;
    foundImages?: number;
    reloadedImages?: number;
    decodedImages?: number;
    error?: string;
  },
): void {
  if (mainCardImageDiagAnchorPerfMs === null) {
    markMainCardImageDiagAnchor();
  }
  logTagged("main-card-image", {
    phase,
    id: payload.id ?? "",
    url: payload.url ?? "",
    elapsedMs: payload.elapsedMs ?? getMainPreloadElapsedMs(),
    relativeMs: payload.relativeMs ?? getMainCardImageDiagRelativeMs(),
    visibleOrNearCount: payload.visibleOrNearCount,
    totalRenderedCount: payload.totalRenderedCount,
    totalDeckItems: payload.totalDeckItems,
    foundImages: payload.foundImages,
    reloadedImages: payload.reloadedImages,
    decodedImages: payload.decodedImages,
    error: payload.error ?? "",
  });
}

export function isMainScrollDeckImageVisible(img: HTMLImageElement): boolean {
  const r = img.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}

const mainCardImageDecodeRequestCountByUrl = new Map<string, number>();
const mainCardImageDecodeCompleteCountByUrl = new Map<string, number>();

function mainCardImageDecodeCountUrlKey(url: string): string {
  return url.trim();
}

/** URL별 decode() 요청 누적 — 중복 decode 최종 확인용 */
export function logMainCardImageDecodeRequestCount(url: string): void {
  if (!isMainSiteLoadDiagEnabled()) return;
  const key = mainCardImageDecodeCountUrlKey(url);
  if (!key) return;
  if (mainCardImageDiagAnchorPerfMs === null) {
    markMainCardImageDiagAnchor();
  }
  const count = (mainCardImageDecodeRequestCountByUrl.get(key) ?? 0) + 1;
  mainCardImageDecodeRequestCountByUrl.set(key, count);
  logTagged("main-card-image", { phase: "decode-count", url: key, count });
  if (count > 1) {
    logTagged("main-card-image", {
      phase: "duplicate-decode",
      url: key,
      duplicateCount: count - 1,
    });
  }
}

/** URL별 decode() 완료 누적 — 중복 decode 최종 확인용 */
export function logMainCardImageDecodedCount(url: string): void {
  if (!isMainSiteLoadDiagEnabled()) return;
  const key = mainCardImageDecodeCountUrlKey(url);
  if (!key) return;
  if (mainCardImageDiagAnchorPerfMs === null) {
    markMainCardImageDiagAnchor();
  }
  const count = (mainCardImageDecodeCompleteCountByUrl.get(key) ?? 0) + 1;
  mainCardImageDecodeCompleteCountByUrl.set(key, count);
  logTagged("main-card-image", { phase: "decoded-count", url: key, count });
  if (count > 1) {
    logTagged("main-card-image", {
      phase: "duplicate-decode",
      url: key,
      duplicateCount: count - 1,
    });
  }
}
