"use client";

import { useEffect } from "react";

/**
 * 가로보기 전용: 가능한 브라우저에서 landscape 고정(실패 시 무시).
 * 사용자 제스처(페이지 진입) 직후 마운트되어야 lock 성공 확률이 높음.
 */
export default function ApplicationsTableOrientationLock() {
  useEffect(() => {
    const o = typeof screen !== "undefined" ? screen.orientation : null;
    const orient = o as ScreenOrientation & { lock?: (mode: string) => Promise<void> };
    if (!o || typeof orient.lock !== "function") {
      return;
    }
    let cancelled = false;
    void orient.lock("landscape").catch(() => {
      /* iOS 등 미지원·거부 — 무시 */
    });
    return () => {
      if (cancelled) return;
      cancelled = true;
      try {
        orient.unlock();
      } catch {
        /* ignore */
      }
    };
  }, []);
  return null;
}
