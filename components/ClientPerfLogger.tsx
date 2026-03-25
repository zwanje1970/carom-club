"use client";

import { useEffect } from "react";
import { logNavigationTiming, logClientTiming } from "@/lib/perf";

/** 마운트 시 Navigation Timing + hydration 구간 로그 (NEXT_PUBLIC_PERF_LOG === "1" 일 때만) */
export function ClientPerfLogger() {
  useEffect(() => {
    logNavigationTiming();
    const start = typeof performance !== "undefined" ? performance.now() : 0;
    const id = requestAnimationFrame(() => {
      logClientTiming("first_paint_estimate", start);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}
