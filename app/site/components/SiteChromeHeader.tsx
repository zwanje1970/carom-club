import { Fragment } from "react";
import Link from "next/link";
import VenuesDistanceNavLink from "./VenuesDistanceNavLink";
import type { SiteLayoutMenuItem } from "../../../lib/types/entities";
import type { PcSiteHeaderAdminEntry } from "../lib/site-pc-header-admin";

function isMobileUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return ua.includes("iphone") || ua.includes("android") || ua.includes("ipad") || ua.includes("mobile");
}

/** 공개 사이트·클라이언트 PC 헤더 노출 분기와 동일 기준 */
export function isPublicSiteMobileView(headerStore: { get: (name: string) => string | null }): boolean {
  const ua = headerStore.get("user-agent") ?? "";
  if (isMobileUserAgent(ua)) return true;
  if (headerStore.get("sec-ch-ua-mobile") === "?1") return true;
  return false;
}

function splitHeaderMenuItems(menuItems: SiteLayoutMenuItem[]): {
  main: SiteLayoutMenuItem[];
  auxiliary: SiteLayoutMenuItem[];
} {
  return {
    main: menuItems.slice(0, 5),
    auxiliary: menuItems.slice(5),
  };
}

function headerNavPathOnly(href: string): string {
  const p = href.split("?")[0] ?? "";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

function isMypageHeaderHref(href: string): boolean {
  return headerNavPathOnly(href) === "/site/mypage";
}

/** 공개 사이트와 동일 DOM·클래스(헤더만) — `/site`·`/`·클라이언트 PC 등에서 재사용 */
export default function SiteChromeHeader({
  menuItems,
  unreadNotificationCount = 0,
  pcAdminEntry,
}: {
  menuItems: SiteLayoutMenuItem[];
  unreadNotificationCount?: number;
  /** PC 전용: 전달 시에만 마이페이지 옆에 관리자 진입 노출(모바일 분기에서는 넘기지 않음) */
  pcAdminEntry?: PcSiteHeaderAdminEntry;
}) {
  const { main, auxiliary } = splitHeaderMenuItems(menuItems);
  const myBadge =
    unreadNotificationCount > 0 ? (unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount)) : null;

  const adminAfterMypage =
    pcAdminEntry && (pcAdminEntry.showClient || pcAdminEntry.showPlatform) ? (
      <>
        {pcAdminEntry.showClient ? (
          <Link href="/client">
            클라이언트관리자
          </Link>
        ) : null}
        {pcAdminEntry.showPlatform ? (
          <Link href="/platform">
            플랫폼관리자
          </Link>
        ) : null}
      </>
    ) : null;

  const renderMainNav = (item: SiteLayoutMenuItem, index: number) => {
    const showBadge = myBadge != null && isMypageHeaderHref(item.href);
    const inner = item.href.startsWith("/site/venues") ? (
      <VenuesDistanceNavLink href={item.href}>
        {item.label}
      </VenuesDistanceNavLink>
    ) : (
      <Link href={item.href}>
        {item.label}
      </Link>
    );
    if (!showBadge) return inner;
    return (
      <span className="site-header-nav-item-wrap">
        <Link href={item.href} className="site-header-mypage-nav-link">
          {item.label}
        </Link>
        <span className="site-header-unread-badge" aria-label={`읽지 않은 알림 ${unreadNotificationCount}건`}>
          {myBadge}
        </span>
      </span>
    );
  };

  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link className="site-logo" href="/site">
          <span className="site-header-logo-dots" aria-hidden="true">
            <span className="site-header-logo-dot site-header-logo-dot--y">●</span>
            <span className="site-header-logo-dot site-header-logo-dot--r">●</span>
            <span className="site-header-logo-dot site-header-logo-dot--w">●</span>
          </span>
          캐롬클럽
        </Link>
      </div>
      <nav className="site-nav site-nav-mobile" aria-label="사이트 메뉴">
        {main.map((item, index) => (
          <Fragment key={`chrome-main-row-${index}-${item.href}`}>
            {renderMainNav(item, index)}
            {isMypageHeaderHref(item.href) ? adminAfterMypage : null}
          </Fragment>
        ))}
      </nav>
      <nav className="site-nav-aux site-nav-aux-mobile" aria-label="테스트 진입 메뉴">
        {auxiliary.map((item, index) => {
          const showBadge = myBadge != null && isMypageHeaderHref(item.href);
          const inner = !showBadge ? (
            <Link href={item.href}>
              {item.label}
            </Link>
          ) : (
            <span className="site-header-nav-item-wrap">
              <Link href={item.href} className="site-header-mypage-nav-link">
                {item.label}
              </Link>
              <span className="site-header-unread-badge" aria-label={`읽지 않은 알림 ${unreadNotificationCount}건`}>
                {myBadge}
              </span>
            </span>
          );
          return (
            <Fragment key={`chrome-aux-row-${index}-${item.href}`}>
              {inner}
              {isMypageHeaderHref(item.href) ? adminAfterMypage : null}
            </Fragment>
          );
        })}
      </nav>
    </header>
  );
}
