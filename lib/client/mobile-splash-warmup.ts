import { fetchAuthSessionCached } from "./auth-session-fetch-cache";
import { logMainSiteLoadDiag } from "../site/main-site-load-diag";

export const MIN_SPLASH_MS = 3000;
export const MAX_SPLASH_MS = 4000;
const IMAGE_PRELOAD_CONCURRENCY = 3;
const MAIN_SLIDE_PRELOAD_PATH = "/api/site/main-slide-preload";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function preloadImageUntilDeadline(url: string, deadlineAt: number): Promise<"ok" | "fail" | "timeout"> {
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
    img.onload = () => finish("ok");
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

async function preloadImagesWithinBudget(
  imageUrls: string[],
  deadlineAt: number,
): Promise<{ completed: number; stoppedByTimeout: boolean }> {
  let completed = 0;
  let index = 0;
  const inFlight = new Set<Promise<void>>();

  const runOne = async (url: string) => {
    logMainSiteLoadDiag("splash", "image preload item start", { url });
    const result = await preloadImageUntilDeadline(url, deadlineAt);
    if (result === "ok") {
      completed += 1;
      logMainSiteLoadDiag("splash", "image preload item complete", { url, completed });
    } else {
      logMainSiteLoadDiag("splash", "image preload item failed", { url, result });
    }
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

  const stoppedByTimeout = index < imageUrls.length && performance.now() >= deadlineAt;
  if (stoppedByTimeout) {
    logMainSiteLoadDiag("splash", "image preload stopped by splash timeout", {
      queued: imageUrls.length,
      started: index,
      completed,
    });
  }

  await Promise.allSettled([...inFlight]);
  logMainSiteLoadDiag("splash", "image preload completed count", {
    queued: imageUrls.length,
    completed,
    stoppedByTimeout,
  });
  return { completed, stoppedByTimeout };
}

/**
 * 스플래시: 세션·main-slide-preload·이미지 preload는 백그라운드.
 * 이동 판단은 mount 직후 시작하며 MAX_SPLASH_MS를 API await보다 우선한다.
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

    logMainSiteLoadDiag("splash", "image preload queue count", {
      sinceMountMs: performance.now() - mountAt,
      count: imageUrls.length,
    });
    if (imageUrls.length > 0) {
      void preloadImagesWithinBudget(imageUrls, maxNavAt);
    } else {
      logMainSiteLoadDiag("splash", "image preload completed count", {
        queued: 0,
        completed: 0,
        stoppedByTimeout: false,
      });
    }
  })();

  while (true) {
    const now = performance.now();
    if (now >= maxNavAt) {
      logMainSiteLoadDiag("splash", "max splash timeout reached", { sinceMountMs: now - mountAt });
      break;
    }
    if (now >= minNavAt && sessionDone && mainSlideDataDone) {
      logMainSiteLoadDiag("splash", "min splash elapsed", { sinceMountMs: now - mountAt });
      logMainSiteLoadDiag("splash", "splash navigation allowed", {
        sinceMountMs: now - mountAt,
        authenticated,
        imageUrlsQueued: imageUrls.length,
      });
      break;
    }
    await delay(50);
  }

  return { authenticated, imageUrls };
}
