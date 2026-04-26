"use client";

import type { ReactNode } from "react";
import type { DashboardArea } from "../../lib/dashboard-mobile-route-meta";
import DashboardMobileChromeBar from "./DashboardMobileChromeBar";

/**
 * /client·/platform 모바일: 공개 사이트와 동일 `site-home-top-white--standard` 상단 바 + 본문 스크롤.
 * PC 레이아웃은 변경 없음(미디어쿼리로 모바일 바만 표시).
 */
export default function DashboardMobileChromeLayout({
  area,
  children,
}: {
  area: DashboardArea;
  children: ReactNode;
}) {
  return (
    <div className="app-dashboard-mobile-root" data-dashboard-mobile-area={area}>
      <DashboardMobileChromeBar area={area} />
      {children}
    </div>
  );
}
