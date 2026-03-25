"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";
import { MainPageSwipeArea } from "./MainPageSwipeArea";
import { useGlobalChromeMode } from "@/components/community/BallPlacementFullscreenContext";
import { shouldHideGlobalChromeByPathname } from "@/components/layout/globalChromeRules";

type Props = { children: React.ReactNode; showMainSiteNoteEntry: boolean };

/**
 * 모바일에서 BottomNav 표시 + 본문 하단 여백(pb-28, 2줄 네비 높이).
 * 메인 4페이지(대회/당구장/커뮤니티/마이페이지) 스와이프 영역 적용.
 * /admin/* · /client/* 에서는 BottomNav 미표시, 여백 없음.
 * 도메인 전체화면 모드가 활성화되면 BottomNav 숨김, 여백 제거.
 */
export function MobileBottomNavWrapper({ children, showMainSiteNoteEntry }: Props) {
  const pathname = usePathname() ?? "";
  const chromeMode = useGlobalChromeMode();
  const hideNav = shouldHideGlobalChromeByPathname(pathname) || Boolean(chromeMode?.hideGlobalChrome);

  return (
    <>
      <div className={hideNav ? "" : "pb-28 md:pb-0"}>
        <MainPageSwipeArea>{children}</MainPageSwipeArea>
      </div>
      {!hideNav && <BottomNav showNoteEntry={showMainSiteNoteEntry} />}
    </>
  );
}
