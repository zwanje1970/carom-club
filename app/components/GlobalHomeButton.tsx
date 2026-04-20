"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteMainNavIcon } from "../site/main-nav-icon";

function isInquiryDetailWithComposer(pathname: string): boolean {
  return (
    /^\/platform\/operations\/support\/[^/]+$/.test(pathname) || /^\/client\/settings\/inquiries\/[^/]+$/.test(pathname)
  );
}

function SiteBottomNavHomeIcon() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={true}
    >
      <path d="M3 11.5L12 4l9 7.5" />
      <path d="M5 10.5V20h14v-9.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

const SITE_NAV_ITEMS = [
  { href: "/site", label: "홈", icon: "home" as const },
  { href: "/site/tournaments", label: "대회안내", icon: "tournament" as const },
  { href: "/site/venues", label: "당구장안내", icon: "venue" as const },
  { href: "/site/community", label: "커뮤니티", icon: "community" as const },
  { href: "/site/mypage", label: "MY", icon: "user" as const },
];

function navItemActive(pathname: string, href: string): boolean {
  if (href === "/site") {
    return pathname === "/site" || pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 모바일: 하단 5버튼 (데스크톱은 CSS로 숨김) */
export default function GlobalHomeButton() {
  const pathname = usePathname() ?? "";
  const overInquiryComposer = isInquiryDetailWithComposer(pathname);

  return (
    <div
      className="site-home-fab-root"
      style={{
        bottom: overInquiryComposer
          ? "calc(3.875rem + env(safe-area-inset-bottom, 0px))"
          : 0,
        zIndex: 70,
      }}
    >
      <nav className="site-mobile-bottom-nav" aria-label="사이트 하단 메뉴">
        {SITE_NAV_ITEMS.map((item) => {
          const active = navItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`site-mobile-bottom-nav__link${active ? " site-mobile-bottom-nav__link--active" : ""}`}
              aria-current={active ? "page" : undefined}
              {...(item.href.startsWith("/site/venues")
                ? {
                    "data-distance-trigger": "true",
                    "data-lat-key": "distanceLat",
                    "data-lng-key": "distanceLng",
                    "data-denied-key": "distanceDenied",
                  }
                : {})}
            >
              <span className="site-mobile-bottom-nav__icon">
                {item.icon === "home" ? (
                  <SiteBottomNavHomeIcon />
                ) : (
                  <SiteMainNavIcon variant={item.icon} size={15} />
                )}
              </span>
              <span className="site-mobile-bottom-nav__label">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
