import { fetchAuthSessionCached } from "./auth-session-fetch-cache";
import { logMainPreload, getMainPreloadElapsedMs } from "../site/main-card-image-preload-diag";
import { logMainSiteLoadDiag } from "../site/main-site-load-diag";

export const MIN_SPLASH_MS = 3000;
export const MAX_SPLASH_MS = 6000;
/** 첫 화면 우선 preload — 메인 segment a eager(≈3)+여유 */
export const PRIORITY_IMAGE_COUNT = 6;
const IMAGE_PRELOAD_CONCURRENCY = 3;
const MAIN_SLIDE_PRELOAD_PATH = "/api/site/main-slide-preload";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function selectPriorityImageUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= PRIORITY_IMAGE_COUNT) break;
  }
  return out;
}

/** load 완료 후 decode 시도 — decode 실패·미지원도 ok/fail로 진행(진입 차단 없음) */
function preloadPriorityImageUntilDeadline(
  url: string,
  deadlineAt: number,
): Promise<"ok" | "fail" | "timeout"> {
  const remaining = deadlineAt - performance.now();
  if (remaining <= 0) return Promise.resolve("timeout");

  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (result: "ok" | "fail" | "timeout") => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(result);
    };
    const timer = window.setTimeout(() => finish("timeout"), remaining);
    img.onload = () => {
      logMainPreload("splash-priority-image-loaded", {
        url,
        elapsedMs: getMainPreloadElapsedMs(),
      });
      const afterDecodeAttempt = () => finish("ok");
      if (typeof img.decode === "function") {
        void img.decode()
          .then(() => {
            logMainPreload("splash-priority-image-decoded", {
              url,
              elapsedMs: getMainPreloadElapsedMs(),
            });
          })
          .catch(() => {
            /* load 완료 — decode 실패도 준비 시도 완료 */
          })
          .finally(afterDecodeAttempt);
        return;
      }
      afterDecodeAttempt();
    };
    img.onerror = () => finish("fail");
    img.decoding = "async";
    img.src = url;
  });
}

async function fetchMainSlideImageUrls(): Promise<string[]> {
  const res = await fetch(MAIN_SLIDE_PRELOAD_PATH, { credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error(`main-slide-preload ${res.status}`);
  const json = (await res.json()) as { imageUrls?: unknown };
  if (!Array.isArray(json.imageUrls)) return [];
  return json.imageUrls
    .filter((u): u is string => typeof u === "string")
    .map((u) => u.trim())
    .filter(Boolean);
}

async function preloadPriorityImagesWithinBudget(
  imageUrls: string[],
  deadlineAt: number,
): Promise<{ readyCount: number; requestedCount: number; attemptsDone: number }> {
  const requestedCount = imageUrls.length;
  if (requestedCount === 0) {
    return { readyCount: 0, requestedCount: 0, attemptsDone: 0 };
  }

  let readyCount = 0;
  let attemptsDone = 0;
  let index = 0;
  const inFlight = new Set<Promise<void>>();

  const runOne = async (url: string) => {
    const result = await preloadPriorityImageUntilDeadline(url, deadlineAt);
    attemptsDone += 1;
    if (result === "ok") readyCount += 1;
  };

  while (index < imageUrls.length && performance.now() < deadlineAt) {
    while (inFlight.size >= IMAGE_PRELOAD_CONCURRENCY && performance.now() < deadlineAt) {
      await Promise.race([...inFlight, delay(25)]);
    }
    if (performance.now() >= deadlineAt) break;

    const url = imageUrls[index]!;
    index += 1;
    const job = runOne(url).finally(() => {
      inFlight.delete(job);
    });
    inFlight.add(job);
  }

  await Promise.allSettled([...inFlight]);

  return { readyCount, requestedCount, attemptsDone };
}

function logNavigationWaitReason(payload: {
  sessionDone: boolean;
  mainSlideDataDone: boolean;
  priorityImagesReady: boolean;
  minSplashElapsed: boolean;
  maxSplashReached: boolean;
  sinceMountMs: number;
  priorityReadyCount?: number;
  priorityRequestedCount?: number;
}): void {
  logMainSiteLoadDiag("splash", "navigation-wait-reason", {
    phase: "navigation-wait-reason",
    sinceMountMs: payload.sinceMountMs,
    sessionDone: payload.sessionDone,
    mainSlideDataDone: payload.mainSlideDataDone,
    priorityImagesReady: payload.priorityImagesReady,
    minSplashElapsed: payload.minSplashElapsed,
    maxSplashReached: payload.maxSplashReached,
    priorityReadyCount: payload.priorityReadyCount ?? 0,
    priorityRequestedCount: payload.priorityRequestedCount ?? 0,
  });
}

/**
 * 스플래시: session·main-slide-preload·우선 이미지 load+decode 시도 완료 후 이동(최소·최대 시간 적용).
 */
export async function runMobileSplashWarmup(mountAt: number): Promise<{
  authenticated: boolean;
  imageUrls: string[];
}> {
  const minNavAt = mountAt + MIN_SPLASH_MS;
  const maxNavAt = mountAt + MAX_SPLASH_MS;

  let authenticated = false;
  let imageUrls: string[] = [];
  let sessionDone = false;
  let mainSlideDataDone = false;
  let priorityImagesReady = false;
  let priorityReadyCount = 0;
  let priorityRequestedCount = 0;

  void (async () => {
    logMainSiteLoadDiag("splash", "session check start", { sinceMountMs: performance.now() - mountAt });
    try {
      const session = await fetchAuthSessionCached();
      authenticated = session.authenticated === true;
      logMainSiteLoadDiag("splash", "session check complete", {
        sinceMountMs: performance.now() - mountAt,
        authenticated,
      });
    } catch (err: unknown) {
      logMainSiteLoadDiag("splash", "session check failed", {
        sinceMountMs: performance.now() - mountAt,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      sessionDone = true;
    }
  })();

  void (async () => {
    logMainSiteLoadDiag("splash", "main slide preload start", { sinceMountMs: performance.now() - mountAt });
    try {
      imageUrls = await fetchMainSlideImageUrls();
      logMainSiteLoadDiag("splash", "main slide preload complete", {
        sinceMountMs: performance.now() - mountAt,
        imageCount: imageUrls.length,
      });
    } catch (err: unknown) {
      logMainSiteLoadDiag("splash", "main slide preload failed", {
        sinceMountMs: performance.now() - mountAt,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      mainSlideDataDone = true;
    }

    const priorityUrls = selectPriorityImageUrls(imageUrls);
    priorityRequestedCount = priorityUrls.length;
    logMainPreload("splash-priority-images-selected", {
      count: priorityUrls.length,
      urls: priorityUrls.join(","),
      elapsedMs: getMainPreloadElapsedMs(),
    });
    logMainSiteLoadDiag("splash", "priority image queue", {
      sinceMountMs: performance.now() - mountAt,
      count: priorityUrls.length,
    });

    if (priorityUrls.length === 0) {
      priorityImagesReady = true;
      logMainPreload("splash-priority-images-ready", {
        readyCount: 0,
        requestedCount: 0,
        elapsedMs: getMainPreloadElapsedMs(),
      });
      return;
    }

    const result = await preloadPriorityImagesWithinBudget(priorityUrls, maxNavAt);
    priorityReadyCount = result.readyCount;
    priorityRequestedCount = result.requestedCount;
    logMainPreload("splash-priority-images-ready", {
      readyCount: result.readyCount,
      requestedCount: result.requestedCount,
      elapsedMs: getMainPreloadElapsedMs(),
    });
    logMainSiteLoadDiag("splash", "priority images preload finished", {
      sinceMountMs: performance.now() - mountAt,
      readyCount: result.readyCount,
      requestedCount: result.requestedCount,
      attemptsDone: result.attemptsDone,
    });
    priorityImagesReady = true;
  })();

  while (true) {
    const now = performance.now();
    const sinceMountMs = now - mountAt;
    const minSplashElapsed = now >= minNavAt;
    const maxSplashReached = now >= maxNavAt;

    if (maxSplashReached) {
      logMainSiteLoadDiag("splash", "max splash timeout reached", { sinceMountMs });
      logNavigationWaitReason({
        sessionDone,
        mainSlideDataDone,
        priorityImagesReady,
        minSplashElapsed,
        maxSplashReached: true,
        sinceMountMs,
        priorityReadyCount,
        priorityRequestedCount,
      });
      break;
    }
    if (minSplashElapsed && sessionDone && mainSlideDataDone && priorityImagesReady) {
      logMainSiteLoadDiag("splash", "min splash elapsed", { sinceMountMs });
      logMainSiteLoadDiag("splash", "splash navigation allowed", {
        sinceMountMs,
        authenticated,
        imageUrlsQueued: imageUrls.length,
        priorityReadyCount,
        priorityRequestedCount,
      });
      logNavigationWaitReason({
        sessionDone,
        mainSlideDataDone,
        priorityImagesReady,
        minSplashElapsed: true,
        maxSplashReached: false,
        sinceMountMs,
        priorityReadyCount,
        priorityRequestedCount,
      });
      break;
    }
    await delay(50);
  }

  return { authenticated, imageUrls };
}
