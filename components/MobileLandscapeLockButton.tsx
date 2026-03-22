"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** TS lib 일부 버전에 lock/unlock 시그니처가 없어 확장 */
type ScreenOrientationLockable = ScreenOrientation & {
  lock?: (orientation: "landscape-primary" | "portrait-primary" | "natural") => Promise<void>;
  unlock?: () => void;
};

const BTN_CONSOLE =
  "rounded border border-zinc-400 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

const BTN_ADMIN =
  "rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700";

/**
 * 모바일에서 Screen Orientation API로 가로 화면 고정(또는 해제).
 * 클라이언트 콘솔·플랫폼 관리자 상단 바 등에서 사용.
 */
export function MobileLandscapeLockButton({ appearance = "console" }: { appearance?: "console" | "admin" }) {
  const [mounted, setMounted] = useState(false);
  const [locked, setLocked] = useState(false);
  const [tip, setTip] = useState<string | null>(null);
  const openedFsForLock = useRef(false);
  const btnClass = appearance === "admin" ? BTN_ADMIN : BTN_CONSOLE;
  const placeholderClass =
    appearance === "admin"
      ? "md:hidden inline-flex h-8 w-[4.5rem] shrink-0 rounded-lg border border-gray-300 bg-white dark:border-slate-600 dark:bg-slate-800"
      : "md:hidden inline-flex h-8 w-[4.5rem] shrink-0 rounded border border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900";

  useEffect(() => {
    setMounted(true);
  }, []);

  const unlock = useCallback(() => {
    try {
      (screen.orientation as ScreenOrientationLockable | undefined)?.unlock?.();
    } catch {
      /* noop */
    }
    if (openedFsForLock.current && document.fullscreenElement) {
      openedFsForLock.current = false;
      void document.exitFullscreen().catch(() => undefined);
    }
    setLocked(false);
    setTip(null);
  }, []);

  const lockLandscape = useCallback(async () => {
    setTip(null);
    const orient =
      typeof screen !== "undefined" ? (screen.orientation as ScreenOrientationLockable | null) : null;
    if (!orient || typeof orient.lock !== "function") {
      setTip("이 브라우저는 화면 방향 고정을 지원하지 않습니다. 기기를 가로로 돌려 주세요.");
      return;
    }

    const tryLock = () => orient.lock!("landscape-primary");

    try {
      await tryLock();
      setLocked(true);
      return;
    } catch {
      /* 일부 브라우저는 전체화면 후에만 lock 허용 */
    }

    try {
      await document.documentElement.requestFullscreen();
      openedFsForLock.current = true;
      await tryLock();
      setLocked(true);
    } catch {
      if (openedFsForLock.current && document.fullscreenElement) {
        openedFsForLock.current = false;
        void document.exitFullscreen();
      }
      setTip("이 기기에서는 화면 고정을 쓸 수 없습니다. 자동 회전을 켜고 기기를 가로로 돌려 주세요.");
    }
  }, []);

  if (!mounted) {
    return <span className={placeholderClass} aria-hidden />;
  }

  return (
    <div className="md:hidden flex min-w-0 flex-col items-end gap-0.5">
      <div className="flex shrink-0 gap-1">
        {!locked ? (
          <button type="button" onClick={() => void lockLandscape()} className={btnClass}>
            가로보기
          </button>
        ) : (
          <button type="button" onClick={unlock} className={btnClass}>
            세로 허용
          </button>
        )}
      </div>
      {tip ? (
        <p
          className={`max-w-[11rem] text-right text-[10px] leading-tight ${
            appearance === "admin"
              ? "text-amber-800 dark:text-amber-200"
              : "text-amber-700 dark:text-amber-300"
          }`}
        >
          {tip}
        </p>
      ) : null}
    </div>
  );
}
