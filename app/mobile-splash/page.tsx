"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { runMobileSplashWarmup } from "../../lib/client/mobile-splash-warmup";
import { markMainPreloadAppStart } from "../../lib/site/main-card-image-preload-diag";
import { isMainSiteLoadDiagEnabled, logMainSiteLoadDiag } from "../../lib/site/main-site-load-diag";

export default function MobileSplashPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const mountAt = performance.now();
    markMainPreloadAppStart();
    if (isMainSiteLoadDiagEnabled()) {
      logMainSiteLoadDiag("splash", "mounted", { mountAt });
    }

    logMainSiteLoadDiag("splash", "prefetch /site start", { sinceMountMs: performance.now() - mountAt });
    const prefetchStartedAt = performance.now();
    try {
      const prefetchResult = router.prefetch("/site") as void | Promise<void>;
      if (
        prefetchResult != null &&
        typeof prefetchResult === "object" &&
        "then" in prefetchResult &&
        typeof prefetchResult.then === "function"
      ) {
        void prefetchResult
          .then(() => {
            if (cancelled) return;
            logMainSiteLoadDiag("splash", "prefetch /site complete", {
              elapsedMs: performance.now() - prefetchStartedAt,
              sinceMountMs: performance.now() - mountAt,
            });
          })
          .catch((err: unknown) => {
            if (cancelled) return;
            logMainSiteLoadDiag("splash", "prefetch /site failed", {
              elapsedMs: performance.now() - prefetchStartedAt,
              sinceMountMs: performance.now() - mountAt,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      } else {
        logMainSiteLoadDiag("splash", "prefetch /site invoked (no completion promise)", {
          elapsedMs: performance.now() - prefetchStartedAt,
          sinceMountMs: performance.now() - mountAt,
        });
      }
    } catch (err: unknown) {
      logMainSiteLoadDiag("splash", "prefetch /site threw", {
        elapsedMs: performance.now() - prefetchStartedAt,
        sinceMountMs: performance.now() - mountAt,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    void (async () => {
      await runMobileSplashWarmup(mountAt);
      if (cancelled) return;
      logMainSiteLoadDiag("splash", "router.push /site", { sinceMountMs: performance.now() - mountAt });
      router.push("/site");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <MotionlessSplash />
  );
}

function MotionlessSplash() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        backgroundColor: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        margin: 0,
      }}
    >
      <img
        src="/splash.png"
        alt="splash"
        style={{ width: "90%", maxWidth: "90vw", height: "auto" }}
      />
    </div>
  );
}
