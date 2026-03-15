"use client";

import { usePathname } from "next/navigation";
import { MainSiteHeader } from "./MainSiteHeader";

/** /admin·/client에서는 공용 헤더 표시(모바일에서도). 그 외 공개 페이지는 모바일에서 헤더 숨김. */
export function MainSiteHeaderWrapper() {
  const pathname = usePathname() ?? "";
  const hideOnMobile = !pathname.startsWith("/admin") && !pathname.startsWith("/client");
  return <MainSiteHeader hideOnMobile={hideOnMobile} />;
}
