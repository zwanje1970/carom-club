"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

const LOCK_MIN_PX = 10;
const FOLLOW_RATIO = 0.78;
const COMPLETE_FRACTION = 0.28;
const VELOCITY_COMPLETE = 0.42;
const TRANSITION_MS = 300;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

type Tab = { key: string; href: string };

function pathOnly(href: string): string {
  const p = href.split("?")[0] ?? "";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function swipeIndexForPathname(pathname: string, tabs: Tab[]): number {
  const norm = pathOnly(pathname);
  return tabs.findIndex((t) => pathOnly(t.href) === norm);
}

function touchBlocksCommunitySwipe(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (el.closest("[data-no-community-board-swipe]")) return true;
  if (el.closest("input,textarea,select,button,iframe,video,audio,summary")) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  if (el.closest('[role="button"],[role="tab"],[role="tablist"]')) return true;
  if (el.closest("label")) return true;
  return false;
}

function velocityFromSamples(samples: { t: number; x: number }[]): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  const windowMs = 90;
  let first = samples[0]!;
  for (let i = samples.length - 2; i >= 0; i--) {
    const s = samples[i]!;
    if (last.t - s.t <= windowMs) first = s;
    else break;
  }
  const dt = last.t - first.t;
  if (dt < 1) return 0;
  return (last.x - first.x) / dt;
}

export default function CommunityBoardSwipeShell({ tabs, children }: { tabs: Tab[]; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragPxRef = useRef(0);
  const animatingRef = useRef(false);
  const startRef = useRef<{
    x: number;
    y: number;
    blocked: boolean;
    startedOnLink: boolean;
    horizontalLocked: boolean;
    verticalDominant: boolean;
  } | null>(null);
  const samplesRef = useRef<{ t: number; x: number }[]>([]);
  const navHrefRef = useRef<string | null>(null);

  const activeIdx = swipeIndexForPathname(pathname, tabs);
  const n = tabs.length;

  const setTrackTransform = useCallback((dragPx: number, withTransition: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    dragPxRef.current = dragPx;
    track.style.transition = withTransition ? `transform ${TRANSITION_MS}ms ${EASING}` : "none";
    /* % 는 트랙(300% 너비) 기준 — 부모 뷰포트와 정확히 맞춰 한 패널만 노출 */
    track.style.transform = `translate3d(calc(-100% / 3 + ${dragPx}px), 0, 0)`;
  }, []);

  useLayoutEffect(() => {
    animatingRef.current = false;
    navHrefRef.current = null;
    const vp = viewportRef.current;
    if (vp) vp.style.removeProperty("touch-action");
    if (trackRef.current && n > 0 && activeIdx >= 0) {
      setTrackTransform(0, false);
    }
  }, [pathname, activeIdx, n, setTrackTransform]);

  useEffect(() => {
    if (n < 2 || activeIdx < 0) return;

    const killLinkClick = () => {
      const kill: EventListener = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        document.removeEventListener("click", kill, true);
      };
      document.addEventListener("click", kill, true);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      if (animatingRef.current) return;
      const t = e.touches[0];
      if (!t) return;
      const blocked = touchBlocksCommunitySwipe(e.target);
      const startedOnLink = e.target instanceof Element && !!e.target.closest("a[href]");
      startRef.current = {
        x: t.clientX,
        y: t.clientY,
        blocked,
        startedOnLink,
        horizontalLocked: false,
        verticalDominant: false,
      };
      samplesRef.current = [{ t: Date.now(), x: t.clientX }];
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const start = startRef.current;
      if (!start || start.blocked || animatingRef.current) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (start.verticalDominant) return;

      if (!start.horizontalLocked) {
        if (adx < LOCK_MIN_PX && ady < LOCK_MIN_PX) return;
        if (ady >= adx) {
          start.verticalDominant = true;
          return;
        }
        start.horizontalLocked = true;
        const vp = viewportRef.current;
        if (vp) vp.style.setProperty("touch-action", "none");
      }

      if (!start.horizontalLocked) return;
      e.preventDefault();

      samplesRef.current.push({ t: Date.now(), x: t.clientX });
      const tail = samplesRef.current;
      if (tail.length > 12) samplesRef.current = tail.slice(-12);

      const vw = window.innerWidth;
      let raw = dx * FOLLOW_RATIO;
      if (activeIdx <= 0 && raw > 0) raw = 0;
      if (activeIdx >= n - 1 && raw < 0) raw = 0;
      raw = Math.max(-vw, Math.min(vw, raw));

      setTrackTransform(raw, false);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const start = startRef.current;
      const t = e.changedTouches[0];
      const velocitySamples =
        start && t ? [...samplesRef.current, { t: Date.now(), x: t.clientX }] : [];
      const startedOnLink = start?.startedOnLink ?? false;
      startRef.current = null;
      samplesRef.current = [];
      const vp = viewportRef.current;
      if (vp) vp.style.removeProperty("touch-action");

      if (!start || start.blocked || animatingRef.current) return;
      if (!t) return;

      if (!start.horizontalLocked || start.verticalDominant) {
        if (dragPxRef.current !== 0) setTrackTransform(0, true);
        return;
      }

      const vw = window.innerWidth;
      const threshold = vw * COMPLETE_FRACTION;
      const dragPx = dragPxRef.current;
      const vx = velocityFromSamples(velocitySamples);

      let nextIdx: number | null = null;
      if (dragPx < 0 && activeIdx < n - 1) {
        if (dragPx <= -threshold || vx < -VELOCITY_COMPLETE) nextIdx = activeIdx + 1;
      } else if (dragPx > 0 && activeIdx > 0) {
        if (dragPx >= threshold || vx > VELOCITY_COMPLETE) nextIdx = activeIdx - 1;
      }

      if (nextIdx == null) {
        setTrackTransform(0, true);
        return;
      }

      const href = tabs[nextIdx]!.href;
      animatingRef.current = true;
      navHrefRef.current = href;

      const track = trackRef.current;
      const endTransform =
        nextIdx > activeIdx ? `translate3d(calc(-200% / 3), 0, 0)` : `translate3d(0px, 0, 0)`;
      if (track) {
        track.style.transition = `transform ${TRANSITION_MS}ms ${EASING}`;
        track.style.transform = endTransform;
      }

      let finished = false;
      let fallbackTimer: number | undefined;

      const finish = () => {
        if (finished) return;
        finished = true;
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
        track?.removeEventListener("transitionend", onTrEnd);
        const h = navHrefRef.current;
        navHrefRef.current = null;
        if (h) {
          router.push(h);
          if (startedOnLink) killLinkClick();
        }
        animatingRef.current = false;
      };

      const onTrEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== "transform") return;
        finish();
      };

      fallbackTimer = window.setTimeout(finish, TRANSITION_MS + 120);
      track?.addEventListener("transitionend", onTrEnd);
    };

    const onTouchCancel = () => {
      startRef.current = null;
      samplesRef.current = [];
      const v = viewportRef.current;
      if (v) v.style.removeProperty("touch-action");
      if (dragPxRef.current !== 0 && !animatingRef.current) setTrackTransform(0, true);
    };

    const el = viewportRef.current;
    if (!el) return;

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, opts);
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove, opts);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [pathname, router, tabs, activeIdx, n, setTrackTransform]);

  if (n < 2 || activeIdx < 0) {
    return <>{children}</>;
  }

  return (
    <div ref={viewportRef} className="community-board-swipe-viewport" data-community-inner-swipe>
      <div ref={trackRef} className="community-board-swipe-track">
        {activeIdx > 0 ? (
          <div className="community-board-swipe-panel community-board-swipe-panel--peek" aria-hidden />
        ) : (
          <div className="community-board-swipe-panel community-board-swipe-panel--edge" aria-hidden />
        )}
        <div className="community-board-swipe-panel community-board-swipe-panel--main">{children}</div>
        {activeIdx < n - 1 ? (
          <div className="community-board-swipe-panel community-board-swipe-panel--peek" aria-hidden />
        ) : (
          <div className="community-board-swipe-panel community-board-swipe-panel--edge" aria-hidden />
        )}
      </div>
    </div>
  );
}
