"use client";

import { usePathname } from "next/navigation";
import { MainSiteHeader } from "./MainSiteHeader";
import { MobileSiteHeader } from "./MobileSiteHeader";
import { useBallPlacementFullscreen } from "@/components/community/BallPlacementFullscreenContext";

/** 공개 페이지: 모바일은 로고+점3개 메뉴 헤더, 데스크톱은 풀 헤더. /admin·/client는 풀 헤더만. 당구노트 공 배치 전체화면 시 숨김. */
export function MainSiteHeaderWrapper() {
  const pathname = usePathname() ?? "";
  const fullscreen = useBallPlacementFullscreen();
  const hideOnMobile = !pathname.startsWith("/admin") && !pathname.startsWith("/client");
  if (fullscreen?.isFullscreen) return null;
  return (
    <>
      {hideOnMobile && <MobileSiteHeader />}
      <MainSiteHeader hideOnMobile={hideOnMobile} />
    </>
  );
}
