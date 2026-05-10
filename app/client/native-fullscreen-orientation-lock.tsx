"use client";

import { useEffect } from "react";

/** 브라우저 lock·네이티브 브릿지 공통 요청 모드 */
export type CaromOrientationRequestMode =
  | "portrait"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary";

type CaromOrientationBridge = {
  requestOrientation?: (mode: CaromOrientationRequestMode) => void;
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

export function requestNativeOrientation(mode: CaromOrientationRequestMode, context: string) {
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
    const wantsLandscape =
      mode === "landscape" || mode === "landscape-primary" || mode === "landscape-secondary";
    if (wantsLandscape && hasLegacyL) {
      bridge!.requestLandscape!();
      console.info(LOG_TAG, context, "called CaromAppBridge.requestLandscape (legacy — 방향 미구분)");
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

/** 네이티브 `requestOrientation`와 별도로 `requestLandscape()`만 추가 호출(일부 WebView에서 primary 매핑 실패 시). */
export function requestNativeLandscapeLegacyExtra(context: string): void {
  try {
    const bridge = (window as OrientationBridgeWindow).CaromAppBridge;
    if (typeof bridge?.requestLandscape === "function") {
      bridge.requestLandscape();
      console.info(LOG_TAG, context, "called CaromAppBridge.requestLandscape (extra legacy)");
    }
  } catch (e) {
    console.warn(LOG_TAG, context, "requestLandscape extra threw", e);
  }
}

/** screen.orientation.lock 에 넘길 Orientation Lock Type */
function browserLockOrientationType(mode: CaromOrientationRequestMode): string {
  if (mode === "landscape-primary" || mode === "landscape-secondary" || mode === "portrait") {
    return mode;
  }
  return "landscape";
}

export function requestBrowserOrientation(mode: CaromOrientationRequestMode, context: string) {
  if (hasCaromNativeOrientationBridge()) {
    console.info(LOG_TAG, context, "skip screen.orientation.lock — CaromAppBridge handles orientation");
    return;
  }
  requestBrowserOrientationIgnoringBridge(mode, context);
}

/** 브릿지 유무와 관계없이 `screen.orientation.lock` 시도 — 네이티브 primary 실패 후 fallback 전용 */
export function requestBrowserOrientationIgnoringBridge(mode: CaromOrientationRequestMode, context: string): void {
  const orientation = typeof screen !== "undefined" ? screen.orientation : null;
  const lockable = orientation as (ScreenOrientation & { lock?: (mode: string) => Promise<void> }) | null;
  if (!lockable || typeof lockable.lock !== "function") {
    console.info(LOG_TAG, context, "screen.orientation.lock unavailable");
    return;
  }
  const lockTarget = browserLockOrientationType(mode);
  void lockable.lock(lockTarget).then(
    () => console.info(LOG_TAG, context, "screen.orientation.lock resolved", lockTarget),
    () => console.info(LOG_TAG, context, "screen.orientation.lock rejected", lockTarget),
  );
}

/** 실제 가로 화면 여부 — 요청 성공 여부와 무관 */
export function isCaromViewportLandscape(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (w > 1 && h > 1 && w > h) return true;
  } catch {
    /* ignore */
  }
  try {
    const t = typeof screen !== "undefined" ? screen.orientation?.type : undefined;
    if (typeof t === "string" && t.includes("landscape")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** 대진표 툴바에서 네이티브 가로를 켠 동안 lifecycle 가드가 세로로 덮어쓰지 않게 표시 */
export const CAROM_BRACKET_NATIVE_LANDSCAPE_SESSION_ID = "bracket-view-native-landscape";

const explicitNativeLandscapeSessions = new Set<string>();

export function registerCaromExplicitNativeLandscapeSession(sessionId: string): void {
  const id = sessionId.trim();
  if (!id) return;
  explicitNativeLandscapeSessions.add(id);
}

export function unregisterCaromExplicitNativeLandscapeSession(sessionId: string): void {
  explicitNativeLandscapeSessions.delete(sessionId.trim());
}

export function unregisterAllCaromExplicitNativeLandscapeSessions(): void {
  explicitNativeLandscapeSessions.clear();
}

export function hasCaromExplicitNativeLandscapeSession(): boolean {
  return explicitNativeLandscapeSessions.size > 0;
}

/**
 * 앱 WebView 복구용: 전체화면 해제 시도 + 세로 고정 + 짧은 재시도(100ms·300ms).
 * 일반 브라우저에서는 호출 전제를 두지 않지만, 호출부에서 앱 여부를 필터한다.
 */
export function scheduleCaromAppPortraitRecovery(contextLabel: string): void {
  const ctx = contextLabel.trim() || "app-portrait-recover";
  try {
    const fs = typeof document !== "undefined" ? document.fullscreenElement : null;
    if (fs && typeof document.exitFullscreen === "function") {
      void document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
  restoreCaromFullscreenPortrait(ctx);
  window.setTimeout(() => {
    requestNativeOrientation("portrait", `${ctx}:recover-100`);
    requestBrowserOrientation("portrait", `${ctx}:recover-100`);
    try {
      screen.orientation?.unlock();
    } catch {
      /* ignore */
    }
  }, 100);
  window.setTimeout(() => {
    requestNativeOrientation("portrait", `${ctx}:recover-300`);
    requestBrowserOrientation("portrait", `${ctx}:recover-300`);
    try {
      screen.orientation?.unlock();
    } catch {
      /* ignore */
    }
  }, 300);
}

/** 전체화면 이탈 시 세로 복구 + 160ms 재시도 (기존 NativeFullscreenOrientationLock 동작과 동일) */
export function restoreCaromFullscreenPortrait(contextLabel: string): void {
  const ctx = contextLabel.trim() || "fullscreen";
  requestNativeOrientation("portrait", `${ctx}:unmount`);
  requestBrowserOrientation("portrait", `${ctx}:unmount`);
  try {
    screen.orientation?.unlock();
  } catch {
    /* ignore */
  }
  logViewport(`${ctx}:after-unmount-request`);
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
}

/** 대진표 등 툴바에서 사용 — 기존 시그니처 유지 */
export type CaromToolbarOrientationMode = "landscape" | "portrait";

/**
 * `CaromAppBridge.requestOrientation` + 브라우저 lock 시도 — 마운트형 NativeFullscreenOrientationLock과 동일한 경로.
 * 대진표 보기 등에서 버튼으로 가로/세로 전환할 때 사용합니다.
 */
export function applyCaromOrientationMode(mode: CaromToolbarOrientationMode, context: string): void {
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
  /**
   * 신청자 가로보기: 노치·펀치홀을 물리적으로 왼쪽에 두는 방향(제스처 바는 오른쪽)으로 고정하려면 landscape-primary.
   * 기기·OEM에 따라 반대면 landscape-secondary 로 앱에서 바꿀 수 있음. CSS 회전 금지 — 브릿지/lock API만 사용.
   */
  landscapeLockMode?: "landscape-primary" | "landscape-secondary";
};

/**
 * 앱 WebView `CaromAppBridge.requestOrientation` + 브라우저 lock 시도.
 * 클라이언트 대시보드 전체화면(신청자 가로보기·대진표 보기 등)에서만 사용 — 사이트 공개 메인 번들과 무관.
 */
export default function NativeFullscreenOrientationLock({
  contextLabel,
  landscapeLockMode = "landscape-primary",
}: NativeFullscreenOrientationLockProps) {
  useEffect(() => {
    const ctx = contextLabel.trim() || "fullscreen";
    const landscapeMode: CaromOrientationRequestMode = landscapeLockMode;
    const sessionKey = `native-fullscreen-lock:${ctx}`;

    registerCaromExplicitNativeLandscapeSession(sessionKey);

    requestNativeOrientation(landscapeMode, `${ctx}:mount`);
    requestBrowserOrientation(landscapeMode, `${ctx}:mount`);

    const onOrient = () => logViewport(`${ctx}:orientationchange`);
    window.addEventListener("orientationchange", onOrient);
    const t = window.setTimeout(() => logViewport(`${ctx}:after-mount-500ms`), 500);

    return () => {
      window.removeEventListener("orientationchange", onOrient);
      window.clearTimeout(t);
      unregisterCaromExplicitNativeLandscapeSession(sessionKey);
      restoreCaromFullscreenPortrait(ctx);
    };
  }, [contextLabel, landscapeLockMode]);

  return null;
}
