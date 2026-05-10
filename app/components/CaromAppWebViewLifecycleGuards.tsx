"use client";

import { useEffect, useRef } from "react";
import { isCaromAppWebViewRuntime } from "../../lib/carom-app-webview-runtime";
import {
  hasCaromExplicitNativeLandscapeSession,
  isCaromViewportLandscape,
  scheduleCaromAppPortraitRecovery,
} from "../client/native-fullscreen-orientation-lock";

/**
 * 앱 WebView 전용: 이탈·복귀·회전·리사이즈 시 세로(portrait) 및 모바일 셸 상태 복구를 예약한다.
 * 일반 브라우저에서는 enabled·런타임 판별로 무동작.
 */
export default function CaromAppWebViewLifecycleGuards({
  enabled = false,
}: {
  /** 서버에서 앱 요청으로 판별된 경우 true */
  enabled?: boolean;
}) {
  const activeRef = useRef(false);

  useEffect(() => {
    activeRef.current = Boolean(enabled) || isCaromAppWebViewRuntime();
    if (!activeRef.current) return;

    const recoverHard = (reason: string) => {
      if (!activeRef.current) return;
      scheduleCaromAppPortraitRecovery(`carom-app:${reason}`);
    };

    const recoverIfAutoLandscape = (reason: string) => {
      if (!activeRef.current) return;
      if (hasCaromExplicitNativeLandscapeSession()) return;
      if (isCaromViewportLandscape()) {
        recoverHard(reason);
        return;
      }
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (w > 1 && h > 1 && w > h) recoverHard(reason);
      } catch {
        /* ignore */
      }
    };

    const recoverSoft = (reason: string) => {
      if (!activeRef.current) return;
      if (hasCaromExplicitNativeLandscapeSession()) return;
      recoverHard(reason);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") recoverHard("visibility-hidden");
      else recoverSoft("visibility-visible");
    };

    const onPageHide = () => recoverHard("pagehide");
    const onPageShow = (ev: PageTransitionEvent) => {
      void ev;
      recoverSoft("pageshow");
    };

    const onOrient = () => recoverIfAutoLandscape("orientationchange");
    const onResize = () => recoverIfAutoLandscape("resize");

    const onFocus = () => recoverSoft("window-focus");

    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const onVvResize = () => recoverIfAutoLandscape("visualviewport-resize");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("orientationchange", onOrient);
    window.addEventListener("resize", onResize);
    window.addEventListener("focus", onFocus);
    vv?.addEventListener("resize", onVvResize);

    return () => {
      activeRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("focus", onFocus);
      vv?.removeEventListener("resize", onVvResize);
    };
  }, [enabled]);

  return null;
}
