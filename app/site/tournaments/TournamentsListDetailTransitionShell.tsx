"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

const DURATION_MS = 260;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function normalizePathname(pathname: string): string {
  const raw = pathname.split("?")[0] ?? "";
  if (raw.length > 1 && raw.endsWith("/")) return raw.slice(0, -1);
  return raw;
}

function isTournamentsListPath(p: string): boolean {
  return normalizePathname(p) === "/site/tournaments";
}

/** `/site/tournaments/[id]` 만 — 하위 세그먼트(/apply 등) 제외 */
function isTournamentsDetailOnlyPath(p: string): boolean {
  return /^\/site\/tournaments\/[^/]+$/.test(normalizePathname(p));
}

function isListDetailEligible(p: string): boolean {
  return isTournamentsListPath(p) || isTournamentsDetailOnlyPath(p);
}

export default function TournamentsListDetailTransitionShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const pathKey = normalizePathname(pathname);
  const prevPathRef = useRef<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const raf2Ref = useRef<number | null>(null);
  const transitionEndCleanupRef = useRef<(() => void) | null>(null);

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
    if (isTournamentsListPath(prev) && isTournamentsDetailOnlyPath(current)) direction = "forward";
    else if (isTournamentsDetailOnlyPath(prev) && isTournamentsListPath(current)) direction = "back";

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
        }, DURATION_MS + 80);
        track.addEventListener("transitionend", onEnd);
        transitionEndCleanupRef.current = () => {
          window.clearTimeout(fallbackTimer);
          track.removeEventListener("transitionend", onEnd);
          safeFinish();
        };

        track.style.transition = `transform ${DURATION_MS}ms ${EASING}`;
        track.style.transform = "translate3d(0,0,0)";
      });
    });

    prevPathRef.current = current;

    return () => {
      clearScheduled();
    };
  }, [pathKey]);

  return (
    <div className="site-tournaments-list-detail-transition-viewport">
      <div ref={trackRef} className="site-tournaments-list-detail-transition-track">
        {children}
      </div>
    </div>
  );
}
