"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import VenuesDistanceNavLink from "../site/components/VenuesDistanceNavLink";
import { SITE_ROOT_SWIPE_NAV } from "../site/lib/site-root-swipe-order";

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
            >
              {inner}
            </VenuesDistanceNavLink>
          ) : (
            <Link key={item.href} href={item.href} className={cls} aria-current={active ? "page" : undefined}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
