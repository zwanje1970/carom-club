"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import VenuesDistanceNavLink from "../site/components/VenuesDistanceNavLink";
import { isSiteMainSamplePathname } from "../site/lib/site-main-sample";
import { normalizeSiteRootPathname, SITE_ROOT_SWIPE_NAV } from "../site/lib/site-root-swipe-order";

function isInquiryDetailWithComposer(pathname: string): boolean {
  return (
    /^\/platform\/operations\/support\/[^/]+$/.test(pathname) || /^\/client\/settings\/inquiries\/[^/]+$/.test(pathname)
  );
}

const SITE_NAV_ITEMS = SITE_ROOT_SWIPE_NAV.map((item) => ({
  key: item.key,
  href: item.href,
  label: item.label,
}));

function navItemActive(pathname: string, href: string): boolean {
  const p = normalizeSiteRootPathname(pathname);
  if (href === "/site") {
    return p === "/site" || p === "/";
  }
  return p === href || p.startsWith(`${href}/`);
}

/** 모바일: 하단 5버튼 (데스크톱은 CSS로 숨김) */
export default function GlobalHomeButton() {
  const pathname = usePathname() ?? "";
  const overInquiryComposer = isInquiryDetailWithComposer(pathname);
  /** 커뮤니티 목록·상세에서 하단 5탭이 인접 _rsc를 대량 prefetch 하지 않도록 */
  const suppressBottomNavPrefetch = pathname.startsWith("/site/community");

  /* 서버에서 `next-url`이 비면 샘플 셸 클래스가 빠져 하단 네비 실험 스타일이 적용되지 않음 — pathname으로 동기화 */
  useLayoutEffect(() => {
    const on = isSiteMainSamplePathname(pathname);
    document.querySelectorAll<HTMLElement>(".site-shell").forEach((el) => {
      el.classList.toggle("site-shell--site-main-sample", on);
    });
  }, [pathname]);

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
          const cls = [
            "site-mobile-bottom-nav__link",
            item.key === "home" ? "site-mobile-bottom-nav__link--home" : "",
            active ? "site-mobile-bottom-nav__link--active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          const inner = <span className="site-mobile-bottom-nav__label">{item.label}</span>;
          return item.href.startsWith("/site/venues") ? (
            <VenuesDistanceNavLink
              key={item.href}
              href={item.href}
              className={cls}
              aria-current={active ? "page" : undefined}
              prefetch={suppressBottomNavPrefetch ? false : undefined}
            >
              {inner}
            </VenuesDistanceNavLink>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              className={cls}
              aria-current={active ? "page" : undefined}
              prefetch={suppressBottomNavPrefetch ? false : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
