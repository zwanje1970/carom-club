"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const SPLASH_MIN_MS = 3000;

export default function MobileSplashPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    void router.prefetch("/site");

    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
      });

    void (async () => {
      await delay(SPLASH_MIN_MS);
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
      <img
        src="/splash.png"
        alt="splash"
        style={{ width: "90%", maxWidth: "90vw", height: "auto" }}
      />
    </div>
  );
}
