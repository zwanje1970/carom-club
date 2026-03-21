/**
 * 난구해법 경로 편집 — 브라우저 전체화면 + (가능 시) 가로 화면 고정
 */

function getRequestFullscreen(el: Element): (() => Promise<void>) | null {
  const anyEl = el as Element & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
  };
  if (typeof el.requestFullscreen === "function") {
    return () => Promise.resolve(el.requestFullscreen());
  }
  if (typeof anyEl.webkitRequestFullscreen === "function") {
    return () => Promise.resolve(anyEl.webkitRequestFullscreen!() as Promise<void> | void);
  }
  if (typeof anyEl.mozRequestFullScreen === "function") {
    return () => Promise.resolve(anyEl.mozRequestFullScreen!() as Promise<void> | void);
  }
  return null;
}

export async function requestFullscreenOnElement(el: Element | null): Promise<boolean> {
  if (!el) return false;
  const req = getRequestFullscreen(el);
  if (!req) return false;
  try {
    await req();
    return true;
  } catch {
    return false;
  }
}

export async function exitBrowserFullscreen(): Promise<void> {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
  };
  try {
    if (!document.fullscreenElement) return;
    if (typeof document.exitFullscreen === "function") {
      await document.exitFullscreen();
      return;
    }
    if (typeof doc.webkitExitFullscreen === "function") {
      await Promise.resolve(doc.webkitExitFullscreen());
      return;
    }
    if (typeof doc.mozCancelFullScreen === "function") {
      await Promise.resolve(doc.mozCancelFullScreen());
    }
  } catch {
    /* noop */
  }
}

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: string) => Promise<void>;
};

/** 전체화면 진입 직후 호출 권장 (일부 브라우저는 FS 활성화 후에만 lock 허용) */
export async function lockLandscapeOrientation(): Promise<void> {
  try {
    const o = screen.orientation as ScreenOrientationWithLock | undefined;
    if (o && typeof o.lock === "function") {
      await o.lock("landscape").catch(() => o.lock!("landscape-primary").catch(() => {}));
      return;
    }
  } catch {
    /* noop */
  }
  try {
    const s = screen as unknown as {
      lockOrientation?: (o: string) => boolean;
      mozLockOrientation?: (o: string) => boolean;
    };
    s.lockOrientation?.("landscape");
    s.mozLockOrientation?.("landscape");
  } catch {
    /* noop */
  }
}

export function unlockScreenOrientation(): void {
  try {
    (screen.orientation as ScreenOrientationWithLock | undefined)?.unlock?.();
  } catch {
    /* noop */
  }
  try {
    const s = screen as unknown as {
      unlockOrientation?: () => void;
      mozUnlockOrientation?: () => void;
    };
    s.unlockOrientation?.();
    s.mozUnlockOrientation?.();
  } catch {
    /* noop */
  }
}
