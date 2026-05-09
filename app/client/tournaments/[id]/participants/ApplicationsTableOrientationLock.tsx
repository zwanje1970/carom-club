"use client";

import { useEffect, useRef } from "react";
import {
  isCaromViewportLandscape,
  requestBrowserOrientation,
  requestBrowserOrientationIgnoringBridge,
  requestNativeLandscapeLegacyExtra,
  requestNativeOrientation,
  restoreCaromFullscreenPortrait,
} from "../../../native-fullscreen-orientation-lock";

export type ApplicationsTableLandscapePhase = "pending" | "ready" | "manual";

const CTX = "applications-table-view";
/** primary 반영 대기 후 generic landscape·레거시 브릿지·브라우저 lock 시도 */
const PRIMARY_WAIT_MS = 420;
/** 그래도 가로가 아니면 안내 문구만 (전체 대기 상한) */
const MANUAL_AFTER_MS = 1200;

/**
 * 신청자 table-view: landscape-primary 우선 → 실패 시 landscape·레거시·브라우저 lock fallback.
 * 실제 가로 여부 확인 전까지 가로 표는 상위에서 숨긴다.
 */
export default function ApplicationsTableOrientationLock({
  onPhaseChange,
}: {
  onPhaseChange?: (phase: ApplicationsTableLandscapePhase) => void;
}) {
  const onPhaseChangeRef = useRef(onPhaseChange);
  onPhaseChangeRef.current = onPhaseChange;
  const phaseRef = useRef<ApplicationsTableLandscapePhase>("pending");

  useEffect(() => {
    let cancelled = false;
    let primaryTimer: number | undefined;
    let manualTimer: number | undefined;

    const emit = (p: ApplicationsTableLandscapePhase) => {
      if (cancelled) return;
      if (phaseRef.current === p) return;
      phaseRef.current = p;
      onPhaseChangeRef.current?.(p);
    };

    const considerLandscape = (): boolean => {
      if (!isCaromViewportLandscape()) return false;
      emit("ready");
      return true;
    };

    if (considerLandscape()) {
      return () => {
        cancelled = true;
        restoreCaromFullscreenPortrait(CTX);
      };
    }

    requestNativeOrientation("landscape-primary", `${CTX}:mount-primary`);
    requestBrowserOrientation("landscape-primary", `${CTX}:mount-primary`);

    const bump = () => {
      void considerLandscape();
    };
    window.addEventListener("orientationchange", bump);
    window.addEventListener("resize", bump);

    const runFallback = () => {
      if (cancelled || considerLandscape()) return;
      requestNativeOrientation("landscape", `${CTX}:fallback-landscape`);
      requestNativeLandscapeLegacyExtra(`${CTX}:fallback-legacy`);
      requestBrowserOrientationIgnoringBridge("landscape", `${CTX}:fallback-browser-lock`);
    };

    primaryTimer = window.setTimeout(runFallback, PRIMARY_WAIT_MS);

    manualTimer = window.setTimeout(() => {
      if (cancelled) return;
      if (considerLandscape()) return;
      emit("manual");
    }, MANUAL_AFTER_MS);

    return () => {
      cancelled = true;
      if (primaryTimer !== undefined) window.clearTimeout(primaryTimer);
      if (manualTimer !== undefined) window.clearTimeout(manualTimer);
      window.removeEventListener("orientationchange", bump);
      window.removeEventListener("resize", bump);
      restoreCaromFullscreenPortrait(CTX);
    };
  }, []);

  return null;
}
