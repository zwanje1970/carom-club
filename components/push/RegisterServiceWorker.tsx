"use client";

import { useEffect } from "react";

/**
 * 앱 로드 시 Service Worker 등록 (Web Push 수신용).
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {})
      .catch(() => {});
  }, []);
  return null;
}
