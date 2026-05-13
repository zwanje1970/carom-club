"use client";

import { usePathname } from "next/navigation";
import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { isCommunityBoardListHubPath } from "../lib/site-root-swipe-order";
import {
  CommunityListDetailTransitionContext,
  type CommunityListDetailTransitionContextValue,
} from "./community-list-detail-transition-context";

const MAIN_DURATION_MS = 320;
const MAIN_EASING = "cubic-bezier(0.22, 0.92, 0.32, 1)";
const NUDGE_PX = 14;
const NUDGE_DURATION_MS = 80;
const NUDGE_EASING = "cubic-bezier(0.33, 1, 0.55, 1)";

function normalizePathname(pathname: string): string {
  const raw = pathname.split("?")[0] ?? "";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

/**
 * `/site/community/[board]/[postId]` 만 (게시글 읽기).
 * `/site/community/[board]/write`, `.../edit` 등은 제외.
 */
function isCommunityPostDetailPath(p: string): boolean {
  const n = normalizePathname(p);
  const m = /^\/site\/community\/([^/]+)\/([^/]+)$/.exec(n);
  if (!m?.[2]) return false;
  const idSeg = m[2];
  if (idSeg === "write" || idSeg === "edit" || idSeg === "preview") return false;
  return true;
}

function isCommunityListHubPath(p: string): boolean {
  return isCommunityBoardListHubPath(p);
}

function isListDetailEligible(p: string): boolean {
  return isCommunityListHubPath(p) || isCommunityPostDetailPath(p);
}

export default function CommunityListDetailTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const pathKey = normalizePathname(pathname);
  const pathKeyRef = useRef(pathKey);
  pathKeyRef.current = pathKey;

  const prevPathRef = useRef<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);
  const transitionEndCleanupRef = useRef<(() => void) | null>(null);

  const applyNudgeForward = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!isCommunityListHubPath(pathKeyRef.current)) return;
    track.style.willChange = "transform";
    track.style.transition = `transform ${NUDGE_DURATION_MS}ms ${NUDGE_EASING}`;
    track.style.transform = `translate3d(-${NUDGE_PX}px,0,0)`;
  }, []);

  const applyNudgeBack = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    if (!isCommunityPostDetailPath(pathKeyRef.current)) return;
    track.style.willChange = "transform";
    track.style.transition = `transform ${NUDGE_DURATION_MS}ms ${NUDGE_EASING}`;
    track.style.transform = `translate3d(${NUDGE_PX}px,0,0)`;
  }, []);

  const signalForwardIntent = useCallback(() => {
    applyNudgeForward();
  }, [applyNudgeForward]);

  const signalBackIntent = useCallback(() => {
    applyNudgeBack();
  }, [applyNudgeBack]);

  const ctxValue = useMemo<CommunityListDetailTransitionContextValue>(
    () => ({ signalForwardIntent, signalBackIntent }),
    [signalForwardIntent, signalBackIntent],
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    const prev = prevPathRef.current;
    const current = pathKey;

    const clearScheduled = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (raf2Ref.current != null) {
        cancelAnimationFrame(raf2Ref.current);
        raf2Ref.current = null;
      }
      transitionEndCleanupRef.current?.();
      transitionEndCleanupRef.current = null;
    };

    const resetTrackInstant = () => {
      if (!track) return;
      track.style.transition = "none";
      track.style.transform = "translate3d(0,0,0)";
      track.style.willChange = "auto";
    };

    if (!isListDetailEligible(current)) {
      clearScheduled();
      resetTrackInstant();
      prevPathRef.current = current;
      return;
    }

    if (prev == null || !isListDetailEligible(prev)) {
      clearScheduled();
      resetTrackInstant();
      prevPathRef.current = current;
      return;
    }

    if (prev === current) {
      return;
    }

    let direction: "forward" | "back" | null = null;
    if (isCommunityListHubPath(prev) && isCommunityPostDetailPath(current)) direction = "forward";
    else if (isCommunityPostDetailPath(prev) && isCommunityListHubPath(current)) direction = "back";

    if (direction == null) {
      clearScheduled();
      resetTrackInstant();
      prevPathRef.current = current;
      return;
    }

    clearScheduled();

    if (!track) {
      prevPathRef.current = current;
      return;
    }

    const startX = direction === "forward" ? "100%" : "-100%";
    track.style.willChange = "transform";
    track.style.transition = "none";
    track.style.transform = `translate3d(${startX},0,0)`;

    const finish = () => {
      track.style.willChange = "auto";
      transitionEndCleanupRef.current = null;
    };

    rafRef.current = requestAnimationFrame(() => {
      raf2Ref.current = requestAnimationFrame(() => {
        rafRef.current = null;
        raf2Ref.current = null;
        let done = false;
        const safeFinish = () => {
          if (done) return;
          done = true;
          finish();
        };
        let fallbackTimer: number | undefined;
        const onEnd = (ev: TransitionEvent) => {
          if (ev.propertyName !== "transform") return;
          if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
          track.removeEventListener("transitionend", onEnd);
          safeFinish();
        };
        fallbackTimer = window.setTimeout(() => {
          track.removeEventListener("transitionend", onEnd);
          safeFinish();
        }, MAIN_DURATION_MS + 140);
        track.addEventListener("transitionend", onEnd);
        transitionEndCleanupRef.current = () => {
          window.clearTimeout(fallbackTimer);
          track.removeEventListener("transitionend", onEnd);
          safeFinish();
        };

        track.style.transition = `transform ${MAIN_DURATION_MS}ms ${MAIN_EASING}`;
        track.style.transform = "translate3d(0,0,0)";
      });
    });

    prevPathRef.current = current;

    return () => {
      clearScheduled();
    };
  }, [pathKey]);

  return (
    <CommunityListDetailTransitionContext.Provider value={ctxValue}>
      <div className="site-community-list-detail-transition-viewport">
        <div ref={trackRef} className="site-community-list-detail-transition-track">
          {children}
        </div>
      </div>
    </CommunityListDetailTransitionContext.Provider>
  );
}
