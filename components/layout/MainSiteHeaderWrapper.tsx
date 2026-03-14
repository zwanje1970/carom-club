"use client";

import { usePathname } from "next/navigation";
import { MainSiteHeader } from "./MainSiteHeader";

/** client 구역만 헤더 숨김. /admin에서는 공용 헤더 + 관리자 NavBar 둘 다 표시. 모바일에서는 /admin이 아닐 때만 헤더 숨김. */
export function MainSiteHeaderWrapper() {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/client")) {
    return null;
  }
  const hideOnMobile = !pathname.startsWith("/admin");
  return <MainSiteHeader hideOnMobile={hideOnMobile} />;
}
