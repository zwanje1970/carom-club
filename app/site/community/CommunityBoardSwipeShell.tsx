"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";

/** 방향 판정 전 미세 떨림 무시 — 가로 확정은 adx > 12 && adx > ady 에서만 */
const PROBE_MICRO_PX = 8;
const HORIZONTAL_MIN_DX_PX = 12;
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

/** 목록 허브만: `/site/community`, `/site/community/{board}` — 상세·쓰기 등은 null */
function communityHubPathBoardSegment(pathname: string): string | null {
  const norm = pathOnly(pathname);
  if (norm === "/site/community" || norm === "/site/community/") return "all";
  const prefix = "/site/community/";
  if (!norm.startsWith(prefix)) return null;
  const rest = norm.slice(prefix.length);
  const parts = rest.split("/").filter(Boolean);
  if (parts.length === 0) return "all";
  if (parts.length >= 2) return null;
  const seg = parts[0]!;
  if (seg === "write") return null;
  return seg;
}

function swipeIndexForPathname(pathname: string, tabs: Tab[]): number {
  const norm = pathOnly(pathname);
  const exact = tabs.findIndex((t) => pathOnly(t.href) === norm);
  if (exact >= 0) return exact;
  const seg = communityHubPathBoardSegment(pathname);
  if (seg == null) return -1;
  return tabs.findIndex((t) => t.key === seg);
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

function clampDragPxForAnchor(anchorIdx: number, n: number, raw: number, vw: number): number {
  let v = Math.max(-vw, Math.min(vw, raw));
  if (anchorIdx <= 0) v = Math.min(0, v);
  if (anchorIdx >= n - 1) v = Math.max(0, v);
  return v;
}

export default function CommunityBoardSwipeShell({ tabs, children }: { tabs: Tab[]; children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  /** 터치 제스처는 게시판 본문(중앙 패널)에서만 — 헤더·탭은 셸 쪽에 둠 */
  const swipeTouchSurfaceRef = useRef<HTMLDivElement | null>(null);
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
    /** 제스처 시작 시점 기준의 탭 인덱스(엣지·완료 판정 고정) */
    anchorIdx: number;
  } | null>(null);
  const samplesRef = useRef<{ t: number; x: number }[]>([]);
  const navHrefRef = useRef<string | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;

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
    const touchEl = swipeTouchSurfaceRef.current;
    if (touchEl) touchEl.style.removeProperty("touch-action");
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
        anchorIdx: activeIdx,
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
        if (adx < PROBE_MICRO_PX && ady < PROBE_MICRO_PX) return;
        /* 세로 우선: 세로 성분이 같거나 크면 스와이프 포기 */
        if (ady >= adx) {
          start.verticalDominant = true;
          return;
        }
        /* 가로 후순위: |dx| > 12 이고 가로가 세로보다 클 때만 */
        if (!(adx > HORIZONTAL_MIN_DX_PX && adx > ady)) return;
        if (start.anchorIdx === 0 && dx > 0) return;
        if (start.anchorIdx === n - 1 && dx < 0) return;
        start.horizontalLocked = true;
        const touchEl = swipeTouchSurfaceRef.current;
        if (touchEl) touchEl.style.setProperty("touch-action", "none");
      }

      if (!start.horizontalLocked) return;
      e.preventDefault();

      samplesRef.current.push({ t: Date.now(), x: t.clientX });
      const tail = samplesRef.current;
      if (tail.length > 12) samplesRef.current = tail.slice(-12);

      const vw = window.innerWidth;
      let raw = dx * FOLLOW_RATIO;
      raw = clampDragPxForAnchor(start.anchorIdx, n, raw, vw);

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
      const touchEl = swipeTouchSurfaceRef.current;
      if (touchEl) touchEl.style.removeProperty("touch-action");

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
      const idx = start.anchorIdx;
      if (dragPx < 0 && idx < n - 1) {
        if (dragPx <= -threshold || vx < -VELOCITY_COMPLETE) nextIdx = idx + 1;
      } else if (dragPx > 0 && idx > 0) {
        if (dragPx >= threshold || vx > VELOCITY_COMPLETE) nextIdx = idx - 1;
      }

      if (nextIdx == null || nextIdx < 0 || nextIdx >= n) {
        setTrackTransform(0, true);
        return;
      }

      const href = tabsRef.current[nextIdx]!.href;
      animatingRef.current = true;
      navHrefRef.current = href;

      const track = trackRef.current;
      const endTransform = nextIdx > idx ? `translate3d(calc(-200% / 3), 0, 0)` : `translate3d(0px, 0, 0)`;
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
      const tch = swipeTouchSurfaceRef.current;
      if (tch) tch.style.removeProperty("touch-action");
      if (dragPxRef.current !== 0 && !animatingRef.current) setTrackTransform(0, true);
    };

    const el = swipeTouchSurfaceRef.current;
    if (!el) return;

    const opts: AddEventListenerOptions = { passive: false, capture: true };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, opts);
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      startRef.current = null;
      samplesRef.current = [];
      const tch = swipeTouchSurfaceRef.current;
      if (tch) tch.style.removeProperty("touch-action");
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove, opts);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [pathname, router, activeIdx, n, setTrackTransform]);

  if (n < 2 || activeIdx < 0) {
    return <>{children}</>;
  }

  const swipeEdge: "first" | "last" | "middle" =
    activeIdx <= 0 ? "first" : activeIdx >= n - 1 ? "last" : "middle";

  return (
    <div
      className="community-board-swipe-root"
      data-community-inner-swipe
      data-community-swipe-edge={swipeEdge}
    >
      <div ref={viewportRef} className="community-board-swipe-viewport">
      <div ref={trackRef} className="community-board-swipe-track">
        {activeIdx > 0 ? (
          <div className="community-board-swipe-panel community-board-swipe-panel--peek" aria-hidden />
        ) : (
          <div className="community-board-swipe-panel community-board-swipe-panel--edge" aria-hidden />
        )}
        <div ref={swipeTouchSurfaceRef} className="community-board-swipe-panel community-board-swipe-panel--main">
          {children}
        </div>
        {activeIdx < n - 1 ? (
          <div className="community-board-swipe-panel community-board-swipe-panel--peek" aria-hidden />
        ) : (
          <div className="community-board-swipe-panel community-board-swipe-panel--edge" aria-hidden />
        )}
      </div>
      </div>
    </div>
  );
}
