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

function logTagged(tag: "main-preload", fields: Record<string, string | number | boolean | null | undefined>) {
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

export function isMainScrollDeckImageVisible(img: HTMLImageElement): boolean {
  const r = img.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}
