"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isInquiryDetailWithComposer(pathname: string): boolean {
  return (
    /^\/platform\/operations\/support\/[^/]+$/.test(pathname) || /^\/client\/settings\/inquiries\/[^/]+$/.test(pathname)
  );
}

/** 전역 홈 FAB — 항상 `/site`로 이동 (사이트·클라이언트·플랫폼 레이아웃 공통) */
export default function GlobalHomeButton() {
  const pathname = usePathname() ?? "";
  const overInquiryComposer = isInquiryDetailWithComposer(pathname);

  return (
    <div
      className="site-home-fab-root"
      style={{
        bottom: overInquiryComposer
          ? "calc(7.75rem + env(safe-area-inset-bottom, 0px))"
          : 0,
        zIndex: 70,
      }}
    >
      <div className="site-home-fab-bar">
        <Link
          href="/site"
          className="site-home-fab site-home-fab--soft site-home-fab-link"
          aria-label="홈"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 11.5L12 4l9 7.5" />
            <path d="M5 10.5V20h14v-9.5" />
            <path d="M9.5 20v-5h5v5" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
