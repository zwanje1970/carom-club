"use client";

import type { ReactNode } from "react";
import type { DashboardArea } from "../../lib/dashboard-mobile-route-meta";
import CaromAppWebViewLifecycleGuards from "./CaromAppWebViewLifecycleGuards";
import DashboardMobileChromeBar from "./DashboardMobileChromeBar";

/**
 * /client·/platform 모바일: 공개 사이트와 동일 `site-home-top-white--standard` 상단 바 + 본문 스크롤.
 * PC 레이아웃은 변경 없음(미디어쿼리로 모바일 바만 표시).
 *
 * `forceClientAppMobileLayout`: 앱(WebView) 요청 시 루트에 `[data-carom-app-client-force-mobile-shell="1"]` 부여 —
 * `globals.css`는 이 플래그와 `html[data-mobile-app-shell]`(proxy SSR 헤더·beforeInteractive·경로 동기화) 모두와 매칭한다.
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
