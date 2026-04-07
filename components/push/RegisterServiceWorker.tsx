"use client";

import { useEffect } from "react";

/**
 * 앱 로드 시 Service Worker 등록 (Web Push 수신용).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let timeoutId: number | null = null;
    let idleId: number | null = null;
    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {})
        .catch(() => {});
    };
    timeoutId = window.setTimeout(() => {
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
      if (typeof w.requestIdleCallback === "function") {
        idleId = w.requestIdleCallback(register, { timeout: 2000 });
      } else {
        register();
      }
    }, 1800);
    return () => {
      cancelled = true;
      if (timeoutId != null) window.clearTimeout(timeoutId);
      const w = window as Window & { cancelIdleCallback?: (id: number) => void };
      if (idleId != null && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
    };
  }, []);
  return null;
}
