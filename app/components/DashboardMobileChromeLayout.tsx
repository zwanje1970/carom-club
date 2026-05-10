"use client";

import type { ReactNode } from "react";
import type { DashboardArea } from "../../lib/dashboard-mobile-route-meta";
import CaromAppWebViewLifecycleGuards from "./CaromAppWebViewLifecycleGuards";
import DashboardMobileChromeBar from "./DashboardMobileChromeBar";

/**
 * /client·/platform 모바일: 공개 사이트와 동일 `site-home-top-white--standard` 상단 바 + 본문 스크롤.
 * PC 레이아웃은 변경 없음(미디어쿼리로 모바일 바만 표시).
 *
 * `forceClientAppMobileLayout`: 앱(WebView) 요청 시 뷰포트 폭과 무관하게 /client 모바일 셸 CSS를 켠다.
 * (`globals.css`의 `[data-carom-app-client-force-mobile-shell="1"]`와 대응)
 */
export default function DashboardMobileChromeLayout({
  area,
  children,
  forceClientAppMobileLayout,
}: {
  area: DashboardArea;
  children: ReactNode;
  forceClientAppMobileLayout?: boolean;
}) {
  return (
    <div
      className="app-dashboard-mobile-root"
      data-dashboard-mobile-area={area}
      data-carom-app-client-force-mobile-shell={
        forceClientAppMobileLayout && area === "client" ? "1" : undefined
      }
    >
      {area === "client" ? (
        <CaromAppWebViewLifecycleGuards enabled={Boolean(forceClientAppMobileLayout)} />
      ) : null}
      <DashboardMobileChromeBar area={area} />
      {children}
    </div>
  );
}
