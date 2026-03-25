"use client";

import { usePathname } from "next/navigation";
import { MainSiteHeader } from "./MainSiteHeader";
import { MobileSiteHeader } from "./MobileSiteHeader";
import { useGlobalChromeMode } from "@/components/community/BallPlacementFullscreenContext";
import { shouldHideGlobalChromeByPathname } from "@/components/layout/globalChromeRules";

/** 공개 페이지: 모바일은 로고+점3개 메뉴 헤더, 데스크톱은 풀 헤더. /client·/admin은 전용 콘솔만 사용. */
export function MainSiteHeaderWrapper() {
  const pathname = usePathname() ?? "";
  const chromeMode = useGlobalChromeMode();
  if (shouldHideGlobalChromeByPathname(pathname)) return null;
  const hideOnMobile = true;
  if (chromeMode?.hideGlobalChrome) return null;
  return (
    <>
      {hideOnMobile && <MobileSiteHeader />}
      <MainSiteHeader hideOnMobile={hideOnMobile} />
    </>
  );
}
