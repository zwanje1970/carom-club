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

const LOG_TAG = "[CaromOrientation]";

/** Android 앱 WebView: Activity.requestedOrientation 고정값만 사용 — screen.orientation.lock 은 자동 회전 OFF 에서 실패·무시되는 경우가 많음 */
function hasCaromNativeOrientationBridge(): boolean {
  const bridge = (window as OrientationBridgeWindow).CaromAppBridge;
  return (
    typeof bridge?.requestOrientation === "function" ||
    typeof bridge?.requestLandscape === "function" ||
    typeof bridge?.requestPortrait === "function"
  );
}

function logViewport(context: string) {
  try {
    const vo =
      typeof window !== "undefined" && typeof window.visualViewport !== "undefined"
        ? {
            width: window.visualViewport?.width ?? null,
            height: window.visualViewport?.height ?? null,
            scale: window.visualViewport?.scale ?? null,
          }
        : null;
    console.info(LOG_TAG, context, {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: typeof screen !== "undefined" ? screen.width : null,
      screenHeight: typeof screen !== "undefined" ? screen.height : null,
      angle: typeof screen !== "undefined" ? screen.orientation?.angle : null,
      type: typeof screen !== "undefined" ? screen.orientation?.type : null,
      visualViewport: vo,
    });
  } catch {
    /* ignore */
  }
}

function requestNativeOrientation(mode: OrientationMode, context: string) {
  const bridge = (window as OrientationBridgeWindow).CaromAppBridge;
  const hasReq = typeof bridge?.requestOrientation === "function";
  const hasLegacyL = typeof bridge?.requestLandscape === "function";
  const hasLegacyP = typeof bridge?.requestPortrait === "function";
  console.info(LOG_TAG, context, "native bridge", {
    mode,
    hasRequestOrientation: hasReq,
    hasRequestLandscape: hasLegacyL,
    hasRequestPortrait: hasLegacyP,
  });
  logViewport(`${context} before native`);
  try {
    if (hasReq) {
      bridge!.requestOrientation!(mode);
      console.info(LOG_TAG, context, "called CaromAppBridge.requestOrientation", mode);
      return;
    }
    if (mode === "landscape" && hasLegacyL) {
      bridge!.requestLandscape!();
      console.info(LOG_TAG, context, "called CaromAppBridge.requestLandscape");
      return;
    }
    if (mode === "portrait" && hasLegacyP) {
      bridge!.requestPortrait!();
      console.info(LOG_TAG, context, "called CaromAppBridge.requestPortrait");
      return;
    }
    console.info(LOG_TAG, context, "no native orientation method (browser or old WebView)");
  } catch (e) {
    console.warn(LOG_TAG, context, "native orientation threw", e);
  }
}

function requestBrowserOrientation(mode: OrientationMode, context: string) {
  if (hasCaromNativeOrientationBridge()) {
    console.info(LOG_TAG, context, "skip screen.orientation.lock — CaromAppBridge handles orientation (fixed LANDSCAPE/PORTRAIT)");
    return;
  }
  const orientation = typeof screen !== "undefined" ? screen.orientation : null;
  const lockable = orientation as (ScreenOrientation & { lock?: (mode: string) => Promise<void> }) | null;
  if (!lockable || typeof lockable.lock !== "function") {
    console.info(LOG_TAG, context, "screen.orientation.lock unavailable");
    return;
  }
  void lockable.lock(mode).then(
    () => console.info(LOG_TAG, context, "screen.orientation.lock resolved", mode),
    () => console.info(LOG_TAG, context, "screen.orientation.lock rejected", mode),
  );
}

/**
 * `CaromAppBridge.requestOrientation` + 브라우저 lock 시도 — 마운트형 NativeFullscreenOrientationLock과 동일한 경로.
 * 대진표 보기 등에서 버튼으로 가로/세로 전환할 때 사용합니다.
 */
export function applyCaromOrientationMode(mode: OrientationMode, context: string): void {
  requestNativeOrientation(mode, context);
  requestBrowserOrientation(mode, context);
  if (mode === "portrait" && !hasCaromNativeOrientationBridge()) {
    try {
      screen.orientation?.unlock();
    } catch {
      /* ignore */
    }
  }
}

export type NativeFullscreenOrientationLockProps = {
  /** Log prefix — e.g. applications-table-view / bracket-view */
  contextLabel: string;
};

/**
 * 앱 WebView `CaromAppBridge.requestOrientation` + 브라우저 lock 시도.
 * 클라이언트 대시보드 전체화면(신청자 가로보기·대진표 보기 등)에서만 사용 — 사이트 공개 메인 번들과 무관.
 */
export default function NativeFullscreenOrientationLock({ contextLabel }: NativeFullscreenOrientationLockProps) {
  useEffect(() => {
    const ctx = contextLabel.trim() || "fullscreen";

    requestNativeOrientation("landscape", `${ctx}:mount`);
    requestBrowserOrientation("landscape", `${ctx}:mount`);

    const onOrient = () => logViewport(`${ctx}:orientationchange`);
    window.addEventListener("orientationchange", onOrient);
    const t = window.setTimeout(() => logViewport(`${ctx}:after-mount-500ms`), 500);

    return () => {
      window.removeEventListener("orientationchange", onOrient);
      window.clearTimeout(t);
      requestNativeOrientation("portrait", `${ctx}:unmount`);
      requestBrowserOrientation("portrait", `${ctx}:unmount`);
      /* 브라우저/WebView: 네이티브 portrait 요청만으로 복구가 늦거나 무시되는 경우 대비 — unlock은 브릿지 유무와 무관 시도 */
      try {
        screen.orientation?.unlock();
      } catch {
        /* ignore */
      }
      logViewport(`${ctx}:after-unmount-request`);
      /* Activity 반영 지연 대비 재요청 — 뒤로가기 직후 세로·모바일 셸 레이아웃 안정화 */
      window.setTimeout(() => {
        requestNativeOrientation("portrait", `${ctx}:unmount-retry`);
        requestBrowserOrientation("portrait", `${ctx}:unmount-retry`);
        try {
          screen.orientation?.unlock();
        } catch {
          /* ignore */
        }
        logViewport(`${ctx}:after-unmount-retry`);
      }, 160);
    };
  }, [contextLabel]);

  return null;
}
