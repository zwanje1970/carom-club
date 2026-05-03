"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SPLASH_MIN_MS = 3000;
const SPLASH_MAX_MS = 4500;

export default function MobileSplashPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const prefetchPromise = fetch("/api/site/app-home-shell-prefetch", {
      method: "GET",
      credentials: "same-origin",
    })
      .then(() => undefined)
      .catch(() => undefined);

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      await delay(SPLASH_MIN_MS);
      if (cancelled) return;
      const extraBudget = Math.max(0, SPLASH_MAX_MS - SPLASH_MIN_MS);
      await Promise.race([prefetchPromise, delay(extraBudget)]);
      if (cancelled) return;
      router.push("/site");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

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
      <img src="/splash.png" alt="splash" style={{ width: "45%" }} />
    </div>
  );
}
