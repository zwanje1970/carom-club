"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** 하단 5버튼(`GlobalHomeButton`의 `SITE_NAV_ITEMS`) 순서와 동일 */
const SITE_ROOT_SWIPE_HREFS = [
  "/site",
  "/site/tournaments",
  "/site/venues",
  "/site/community",
  "/site/mypage",
] as const;

function normalizePathname(pathname: string): string {
  if (pathname === "/") return "/";
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function isSiteRootSwipePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (SITE_ROOT_SWIPE_HREFS as readonly string[]).includes(p);
}

function rootSwipeIndex(pathname: string): number {
  const p = normalizePathname(pathname);
  return SITE_ROOT_SWIPE_HREFS.findIndex((h) => h === p);
}

const MIN_SWIPE_PX = 56;
/** 가로가 세로보다 충분히 클 때만 페이지 전환 */
const HORIZONTAL_VS_VERTICAL = 1.35;
const EDGE_EXCLUDE_PX = 24;
const NAV_COOLDOWN_MS = 480;

function touchTargetBlocksSwipe(el: EventTarget | null): boolean {
  if (!el || !(el instanceof Element)) return false;
  if (el.closest("[data-no-root-swipe]")) return true;
  if (el.closest("input,textarea,select,button,iframe,video,audio,summary")) return true;
  if (el.closest('[contenteditable="true"]')) return true;
  if (el.closest('[role="button"],[role="tab"],[role="tablist"]')) return true;
  if (el.closest("label")) return true;
  return false;
}

/**
 * 대표 카테고리 루트 5페이지에서만 좌우 스와이프로 인접 탭 이동.
 * 상세·하위 경로에서는 마운트만 되고 리스너는 등록하지 않음.
 */
export default function SiteRootSwipeNav() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const startRef = useRef<{
    x: number;
    y: number;
    blocked: boolean;
    startedOnLink: boolean;
  } | null>(null);
  const cooldownUntilRef = useRef(0);

  useEffect(() => {
    const allowedPath = isSiteRootSwipePath(pathname);
    if (!allowedPath) return;

    const onTouchStart = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      if (cooldownUntilRef.current > Date.now()) return;
      const t = e.touches[0];
      if (!t) return;
      const w = window.innerWidth;
      const x = t.clientX;
      const edgeSkip = x < EDGE_EXCLUDE_PX || x > w - EDGE_EXCLUDE_PX;
      const blocked = touchTargetBlocksSwipe(e.target) || edgeSkip;
      const startedOnLink = e.target instanceof Element && !!e.target.closest("a[href]");
      startRef.current = { x: t.clientX, y: t.clientY, blocked, startedOnLink };
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!window.matchMedia("(max-width: 767px)").matches) return;
      const start = startRef.current;
      startRef.current = null;
      if (!start || start.blocked) return;
      if (!isSiteRootSwipePath(pathname)) return;

      const t = e.changedTouches[0];
      if (!t) return;

      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (adx < MIN_SWIPE_PX) return;
      if (adx <= ady * HORIZONTAL_VS_VERTICAL) return;

      const idx = rootSwipeIndex(pathname);
      if (idx < 0) return;

      let nextIdx: number | null = null;
      if (dx < 0 && idx < SITE_ROOT_SWIPE_HREFS.length - 1) {
        nextIdx = idx + 1;
      } else if (dx > 0 && idx > 0) {
        nextIdx = idx - 1;
      }
      if (nextIdx === null) return;

      const nextHref = SITE_ROOT_SWIPE_HREFS[nextIdx]!;
      cooldownUntilRef.current = Date.now() + NAV_COOLDOWN_MS;
      router.push(nextHref);

      if (start.startedOnLink) {
        const kill: EventListener = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          document.removeEventListener("click", kill, true);
        };
        document.addEventListener("click", kill, true);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [pathname, router]);

  return null;
}
