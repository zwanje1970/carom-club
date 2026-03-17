"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

/** 메인 4페이지 순서: 당구대회 → 당구장홍보 → 마이페이지 → 커뮤니티. 모바일에서만 스와이프 이동. */
const MAIN_PAGES = ["/tournaments", "/venues", "/mypage", "/community"] as const;
const SWIPE_THRESHOLD = 100; // 카드 가로 스크롤과 구분하기 위해 100px 이상만 페이지 전환
const SWIPE_MAX_VERTICAL_RATIO = 0.6; // 가로 이동이 세로보다 커야 스와이프로 인정

export function useMainPageSwipe() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const index = MAIN_PAGES.indexOf(pathname as (typeof MAIN_PAGES)[number]);
  const isMainPage =
    pathname === "/tournaments" ||
    pathname === "/venues" ||
    pathname === "/mypage" ||
    pathname === "/community";
  const isDetailPage =
    pathname !== "/tournaments" &&
    pathname !== "/venues" &&
    pathname !== "/mypage" &&
    pathname !== "/community" &&
    (pathname.startsWith("/tournaments/") ||
      pathname.startsWith("/venues/") ||
      pathname.startsWith("/community/") ||
      pathname.startsWith("/mypage/"));

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current || index < 0 || isDetailPage) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - touchStart.current.x;
      const deltaY = touch.clientY - touchStart.current.y;
      touchStart.current = null;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
      if (Math.abs(deltaY) > Math.abs(deltaX) * (1 / SWIPE_MAX_VERTICAL_RATIO)) return; // 세로 스크롤 우선
      if (typeof window !== "undefined" && window.innerWidth >= 768) return; // 모바일에서만

      if (deltaX < 0 && index < MAIN_PAGES.length - 1) {
        router.push(MAIN_PAGES[index + 1]);
      } else if (deltaX > 0 && index > 0) {
        router.push(MAIN_PAGES[index - 1]);
      }
    },
    [index, isDetailPage, router]
  );

  return { isMainPage: isMainPage && !isDetailPage, onTouchStart: handleTouchStart, onTouchEnd: handleTouchEnd };
}
