"use client";

import { useEffect } from "react";

type OrientationMode = "landscape" | "portrait";

type CaromOrientationBridge = {
  requestOrientation?: (mode: OrientationMode) => void;
  requestLandscape?: () => void;
  requestPortrait?: () => void;
};

type OrientationBridgeWindow = Window & {
  CaromAppBridge?: CaromOrientationBridge;
};

function requestNativeOrientation(mode: OrientationMode) {
  const bridge = (window as OrientationBridgeWindow).CaromAppBridge;
  try {
    if (typeof bridge?.requestOrientation === "function") {
      bridge.requestOrientation(mode);
      return;
    }
    if (mode === "landscape" && typeof bridge?.requestLandscape === "function") {
      bridge.requestLandscape();
      return;
    }
    if (mode === "portrait" && typeof bridge?.requestPortrait === "function") {
      bridge.requestPortrait();
    }
  } catch {
    /* WebView bridge unavailable/rejected */
  }
}

function requestBrowserOrientation(mode: OrientationMode) {
  const orientation = typeof screen !== "undefined" ? screen.orientation : null;
  const lockable = orientation as (ScreenOrientation & { lock?: (mode: string) => Promise<void> }) | null;
  if (!lockable || typeof lockable.lock !== "function") return;

  void lockable.lock(mode).catch(() => {
    /* Browser may require fullscreen/user activation; layout remains fullscreen table. */
  });
}

/**
 * 가로보기 전용: 별도 회전 유도 UI 없이 진입 즉시 landscape 전환을 시도한다.
 * 앱 WebView 브리지와 브라우저 orientation API를 모두 시도하고, 종료 시 portrait 복귀를 요청한다.
 */
export default function ApplicationsTableOrientationLock() {
  useEffect(() => {
    requestNativeOrientation("landscape");
    requestBrowserOrientation("landscape");

    return () => {
      requestNativeOrientation("portrait");
      requestBrowserOrientation("portrait");
      try {
        screen.orientation?.unlock();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
