"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import {
  isCommunityBoardListHubPath,
  isSiteRootSwipePath,
  siteRootSwipeHrefAt,
  siteRootSwipeIndex,
  SITE_ROOT_SWIPE_NAV,
} from "../lib/site-root-swipe-order";

const EDGE_EXCLUDE_PX = 24;
const NAV_COOLDOWN_MS = 480;
/** 손가락 이동 대비 트랙 이동 비율 */
const FOLLOW_RATIO = 0.78;
/** 방향 판정 전 최소 이동(px) — 미만이면 가로/세로 확정 안 함, preventDefault 금지 */
const PROBE_MIN_PX = 10;
/** 가로 lock: |dx| - |dy| >= 이 값 */
const HORIZONTAL_LEAD_PX = 8;
/** 가로 lock: |dx| 최소 */
const MIN_HORIZONTAL_LOCK_PX = 16;
/** 완료: 손가락 이동 거리 ≥ 뷰포트 너비 × 이 비율 (0.5 = 50%) */
const DISTANCE_COMPLETE_FRACTION = 0.5;
/** 플릭: 최소 |dx|(px) + 속도 동시 만족 시 50% 미만이어도 전환 */
const FLICK_MIN_ABS_DX_PX = 40;
/** 플릭 속도 하한(px/ms) — 과민 방지 */
const VELOCITY_FLICK_PX_PER_MS = 0.36;
const TRANSITION_MS = 300;
const EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

function communitySwipeEdgeFromHost(host: Element | null): "first" | "last" | "middle" | null {
  if (!host) return null;
  const v = host.getAttribute("data-community-swipe-edge");
  if (v === "first" || v === "last" || v === "middle") return v;
  return "middle";
}

function touchTargetBlocksSwipe(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (el.closest("[data-no-root-swipe]")) return true;
  if (el.closest("input,textarea,select,button,iframe,video,audio,summary")) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  if (el.closest('[role="button"],[role="tab"],[role="tablist"]')) return true;
  if (el.closest("label")) return true;
  return false;
}

/** home 전용: 이웃 미리보기 iframe 생략(가벼움). tournaments·venues 등은 그대로 iframe 허용 */
function allowNeighborIframePreview(href: string | null): href is string {
  return Boolean(href && href !== "/site");
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

/**
 * 대표 카테고리 루트 5페이지에서만 좌우 스와이프로 인접 탭 이동.
 * 세로 스크롤 보호: 방향 확정 전 preventDefault·touch-action 변경 금지.
 * 세로 우세(|dy|≥|dx|) 시 제스처 종료까지 루트 비개입.
 */
export default function SiteRootSwipeNav({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const dragPxRef = useRef(0);
  const animatingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const startRef = useRef<{
    x: number;
    y: number;
    t0: number;
    blocked: boolean;
    startedOnLink: boolean;
    horizontalLocked: boolean;
    /** 세로 우선 확정 시 제스처 끝까지 루트 스와이프 포기 */
    verticalDominant: boolean;
    startedOnCommunityHub: boolean;
    startedCommunityEdge: "first" | "last" | "middle" | null;
  } | null>(null);
  const samplesRef = useRef<{ t: number; x: number }[]>([]);
  const navAfterTransitionRef = useRef<string | null>(null);
  const gestureAnchorIdxRef = useRef<number | null>(null);

  const applyTransform = useCallback((dragPx: number, withTransition: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    dragPxRef.current = dragPx;
    track.style.transition = withTransition ? `transform ${TRANSITION_MS}ms ${EASING}` : "none";
    track.style.transform = `translate3d(calc(-100vw + ${dragPx}px), 0, 0)`;
  }, []);

  const releaseViewportTouchAxisLock = useCallback(() => {
    const v = viewportRef.current;
    if (v) v.style.removeProperty("touch-action");
  }, []);

  useLayoutEffect(() => {
    animatingRef.current = false;
    navAfterTransitionRef.current = null;
    gestureAnchorIdxRef.current = null;
    dragPxRef.current = 0;
    releaseViewportTouchAxisLock();
    if (trackRef.current) applyTransform(0, false);
  }, [pathname, applyTransform, releaseViewportTouchAxisLock]);

  useEffect(() => {
    if (children == null) return;
    const allowedPath = isSiteRootSwipePath(pathname);
    if (!allowedPath) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      if (animatingRef.current) return;
      if (cooldownUntilRef.current > Date.now()) return;
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      const x = t.clientX;
      const edgeSkip = x < EDGE_EXCLUDE_PX || x > w - EDGE_EXCLUDE_PX;
      const startedOnCommunityHub = isCommunityBoardListHubPath(pathname);
      const targetEl = e.target instanceof Element ? e.target : null;
      const innerHost = startedOnCommunityHub ? targetEl?.closest("[data-community-inner-swipe]") : null;
      const startedCommunityEdge = communitySwipeEdgeFromHost(innerHost ?? null);
      const blockedByCommunityPolicy = startedOnCommunityHub && !innerHost;
      const blocked = touchTargetBlocksSwipe(e.target) || edgeSkip || blockedByCommunityPolicy;
      const startedOnLink = e.target instanceof Element && !!e.target.closest("a[href]");
      startRef.current = {
        x: t.clientX,
        y: t.clientY,
        t0: Date.now(),
        blocked,
        startedOnLink,
        horizontalLocked: false,
        verticalDominant: false,
        startedOnCommunityHub,
        startedCommunityEdge,
      };
      samplesRef.current = [{ t: Date.now(), x: t.clientX }];
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const start = startRef.current;
      if (!start || start.blocked || animatingRef.current) return;
      if (!isSiteRootSwipePath(pathname)) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (start.verticalDominant) return;

      if (!start.horizontalLocked) {
        if (adx < PROBE_MIN_PX && ady < PROBE_MIN_PX) return;

        if (ady >= adx) {
          start.verticalDominant = true;
          return;
        }

        if (adx < MIN_HORIZONTAL_LOCK_PX) return;
        if (adx - ady < HORIZONTAL_LEAD_PX) return;

        if (start.startedOnCommunityHub) {
          const edge = start.startedCommunityEdge;
          if (!edge) return;
          const passToRoot = (edge === "first" && dx > 0) || (edge === "last" && dx < 0);
          if (!passToRoot) return;
        }

        start.horizontalLocked = true;
        gestureAnchorIdxRef.current = siteRootSwipeIndex(pathname);
        const vp = viewportRef.current;
        if (vp) vp.style.setProperty("touch-action", "none");
      }

      if (!start.horizontalLocked) return;
      e.preventDefault();

      samplesRef.current.push({ t: Date.now(), x: t.clientX });
      const tail = samplesRef.current;
      if (tail.length > 12) samplesRef.current = tail.slice(-12);

      const idx = gestureAnchorIdxRef.current ?? siteRootSwipeIndex(pathname);
      if (idx < 0) return;

      let raw = dx * FOLLOW_RATIO;
      const vw = window.innerWidth;
      if (idx <= 0 && raw > 0) raw = 0;
      if (idx >= SITE_ROOT_SWIPE_NAV.length - 1 && raw < 0) raw = 0;
      raw = Math.max(-vw, Math.min(vw, raw));

      applyTransform(raw, false);
    };

    const killLinkClick = () => {
      const kill: EventListener = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        document.removeEventListener("click", kill, true);
      };
      document.addEventListener("click", kill, true);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const start = startRef.current;
      const t = e.changedTouches[0];
      const velocitySamples =
        start && t ? [...samplesRef.current, { t: Date.now(), x: t.clientX }] : [];
      startRef.current = null;
      samplesRef.current = [];
      releaseViewportTouchAxisLock();

      if (!start || start.blocked || animatingRef.current) {
        gestureAnchorIdxRef.current = null;
        return;
      }
      if (!isSiteRootSwipePath(pathname)) {
        gestureAnchorIdxRef.current = null;
        return;
      }

      if (!t) {
        gestureAnchorIdxRef.current = null;
        return;
      }

      if (!start.horizontalLocked || start.verticalDominant) {
        gestureAnchorIdxRef.current = null;
        if (dragPxRef.current !== 0) applyTransform(0, true);
        return;
      }

      const idx = gestureAnchorIdxRef.current ?? siteRootSwipeIndex(pathname);
      gestureAnchorIdxRef.current = null;
      if (idx < 0) return;

      const vw = window.innerWidth;
      const distanceThreshold = vw * DISTANCE_COMPLETE_FRACTION;
      const fingerDx = t.clientX - start.x;
      const absFinger = Math.abs(fingerDx);
      const vx = velocityFromSamples(velocitySamples);

      const flickNext =
        fingerDx < 0 && absFinger >= FLICK_MIN_ABS_DX_PX && vx < -VELOCITY_FLICK_PX_PER_MS;
      const flickPrev =
        fingerDx > 0 && absFinger >= FLICK_MIN_ABS_DX_PX && vx > VELOCITY_FLICK_PX_PER_MS;

      let nextIdx: number | null = null;
      if (fingerDx < 0 && idx < SITE_ROOT_SWIPE_NAV.length - 1) {
        const wantNext = fingerDx <= -distanceThreshold || flickNext;
        if (wantNext) nextIdx = idx + 1;
      } else if (fingerDx > 0 && idx > 0) {
        const wantPrev = fingerDx >= distanceThreshold || flickPrev;
        if (wantPrev) nextIdx = idx - 1;
      }

      if (nextIdx == null) {
        applyTransform(0, true);
        return;
      }

      const nextHref = siteRootSwipeHrefAt(nextIdx);
      if (!nextHref) {
        applyTransform(0, true);
        return;
      }

      cooldownUntilRef.current = Date.now() + NAV_COOLDOWN_MS;
      animatingRef.current = true;

      if (nextIdx > idx) {
        applyTransform(-vw, true);
      } else {
        applyTransform(vw, true);
      }

      navAfterTransitionRef.current = nextHref;

      const track = trackRef.current;
      let finished = false;
      let fallbackTimer: number | undefined;

      const finishNav = () => {
        if (finished) return;
        finished = true;
        if (fallbackTimer != null) window.clearTimeout(fallbackTimer);
        track?.removeEventListener("transitionend", onTransitionEnd);
        const href = navAfterTransitionRef.current;
        navAfterTransitionRef.current = null;
        if (href) {
          router.push(href);
          if (start.startedOnLink) killLinkClick();
        }
        animatingRef.current = false;
      };

      const onTransitionEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== "transform") return;
        finishNav();
      };

      fallbackTimer = window.setTimeout(finishNav, TRANSITION_MS + 120);
      track?.addEventListener("transitionend", onTransitionEnd);
    };

    const onTouchCancel = () => {
      startRef.current = null;
      samplesRef.current = [];
      gestureAnchorIdxRef.current = null;
      releaseViewportTouchAxisLock();
      if (dragPxRef.current !== 0 && !animatingRef.current) applyTransform(0, true);
    };

    const el = viewportRef.current;
    if (!el) return;

    const touchMoveListenerOpts: AddEventListenerOptions = { passive: false, capture: true };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, touchMoveListenerOpts);
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      startRef.current = null;
      samplesRef.current = [];
      gestureAnchorIdxRef.current = null;
      releaseViewportTouchAxisLock();
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove, touchMoveListenerOpts);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [pathname, router, applyTransform, releaseViewportTouchAxisLock]);

  if (children == null) return null;

  const swipeIdx = siteRootSwipeIndex(pathname);
  const prevHref = siteRootSwipeHrefAt(swipeIdx - 1);
  const nextHref = siteRootSwipeHrefAt(swipeIdx + 1);

  const leftPanel =
    swipeIdx <= 0 ? (
      <div key="swipe-left-ph" className="site-root-swipe-panel site-root-swipe-panel--placeholder" aria-hidden />
    ) : allowNeighborIframePreview(prevHref) ? (
      <div key={`swipe-left-${prevHref}`} className="site-root-swipe-panel site-root-swipe-panel--neighbor">
        <iframe className="site-root-swipe-panel-embed" src={prevHref} title="이전 탭" loading="lazy" />
      </div>
    ) : (
      <div key="swipe-left-edge" className="site-root-swipe-panel site-root-swipe-panel--placeholder" aria-hidden />
    );

  const rightPanel =
    swipeIdx < 0 || swipeIdx >= SITE_ROOT_SWIPE_NAV.length - 1 ? (
      <div key="swipe-right-ph" className="site-root-swipe-panel site-root-swipe-panel--placeholder" aria-hidden />
    ) : allowNeighborIframePreview(nextHref) ? (
      <div key={`swipe-right-${nextHref}`} className="site-root-swipe-panel site-root-swipe-panel--neighbor">
        <iframe className="site-root-swipe-panel-embed" src={nextHref} title="다음 탭" loading="lazy" />
      </div>
    ) : (
      <div key="swipe-right-edge" className="site-root-swipe-panel site-root-swipe-panel--placeholder" aria-hidden />
    );

  return (
    <div ref={viewportRef} className="site-root-swipe-viewport">
      <div className="site-root-swipe-track" ref={trackRef}>
        {leftPanel}
        <div className="site-root-swipe-panel site-root-swipe-panel--main">{children}</div>
        {rightPanel}
      </div>
    </div>
  );
}
