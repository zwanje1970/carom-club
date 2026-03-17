"use client";

import { usePathname } from "next/navigation";
import { useMainPageSwipe } from "./useMainPageSwipe";

/**
 * 대회/당구장/커뮤니티/마이페이지 메인 4페이지만 좌우 스와이프로 이동.
 * 모바일에서만 동작, 하위 페이지에는 미적용.
 */
export function MainPageSwipeArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const { onTouchStart, onTouchEnd } = useMainPageSwipe();

  const isExactMain =
    pathname === "/tournaments" ||
    pathname === "/venues" ||
    pathname === "/mypage" ||
    pathname === "/community";

  if (!isExactMain) {
    return <>{children}</>;
  }

  return (
    <div
      className="min-h-full md:min-h-0"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
