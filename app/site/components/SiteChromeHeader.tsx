"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isPublicSiteMainHomePathname,
  isPublicSiteTournamentsHubPathname,
  isPublicSiteVenuesHubPathname,
} from "../lib/site-root-swipe-order";
import VenuesDistanceNavLink from "./VenuesDistanceNavLink";
import type { SiteLayoutMenuItem } from "../../../lib/types/entities";
import type { PcSiteHeaderAdminEntry } from "../lib/site-pc-header-admin";

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

/** 상단 주요 허브만 — 커뮤니티 체류 시에도 prefetch 허용(냉 네비 완화). 게시판·게시글 URL은 여기 포함하지 않음 */
const SITE_MAIN_HUB_NAV_PATHS = new Set([
  "/",
  "/site",
  "/site/tournaments",
  "/site/venues",
  "/site/community",
  "/site/mypage",
]);

function isSiteMainHubNavHref(href: string): boolean {
  const p = headerNavPathOnly(href);
  return SITE_MAIN_HUB_NAV_PATHS.has(p);
}

/**
 * 메인 홈·대회/클럽 허브 전역(목록·상세·신청 등): 타 허브 RSC 선로딩 금지.
 * 그 외: 커뮤니티가 아닐 때 Next 기본 prefetch, 커뮤니티일 때는 주요 허브만 동일·그 외는 끔.
 */
function prefetchPropForHeaderLink(pathname: string, linkHref: string): boolean | undefined {
  if (isPublicSiteMainHomePathname(pathname)) return false;
  if (isPublicSiteTournamentsHubPathname(pathname)) return false;
  if (isPublicSiteVenuesHubPathname(pathname)) return false;
  if (!pathname.startsWith("/site/community")) return undefined;
  return isSiteMainHubNavHref(linkHref) ? undefined : false;
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
  const pathname = usePathname() ?? "";

  const { main, auxiliary } = splitHeaderMenuItems(menuItems);
  const myBadge =
    unreadNotificationCount > 0 ? (unreadNotificationCount > 99 ? "99+" : String(unreadNotificationCount)) : null;

  const showHeaderAdminEntry =
    pcAdminEntry &&
    (pcAdminEntry.showClient || pcAdminEntry.showPlatform) &&
    !isPublicSiteMainHomePathname(pathname);

  const adminAfterMypage = showHeaderAdminEntry ? (
    <>
      {pcAdminEntry.showClient ? (
        <Link prefetch={prefetchPropForHeaderLink(pathname, "/client")} href="/client">
          클라이언트관리자
        </Link>
      ) : null}
      {pcAdminEntry.showPlatform ? (
        <Link prefetch={prefetchPropForHeaderLink(pathname, "/platform")} href="/platform">
          플랫폼관리자
        </Link>
      ) : null}
    </>
  ) : null;

  const renderMainNav = (item: SiteLayoutMenuItem, index: number) => {
    const showBadge = myBadge != null && isMypageHeaderHref(item.href);
    const navPrefetch = prefetchPropForHeaderLink(pathname, item.href);
    const inner = item.href.startsWith("/site/venues") ? (
      <VenuesDistanceNavLink prefetch={navPrefetch} href={item.href}>
        {item.label}
      </VenuesDistanceNavLink>
    ) : (
      <Link prefetch={navPrefetch} href={item.href}>
        {item.label}
      </Link>
    );
    if (!showBadge) return inner;
    return (
      <span className="site-header-nav-item-wrap">
        <Link prefetch={navPrefetch} href={item.href} className="site-header-mypage-nav-link">
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
        <Link prefetch={prefetchPropForHeaderLink(pathname, "/site")} className="site-logo" href="/site">
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
          const auxPrefetch = prefetchPropForHeaderLink(pathname, item.href);
          const inner = !showBadge ? (
            <Link prefetch={auxPrefetch} href={item.href}>
              {item.label}
            </Link>
          ) : (
            <span className="site-header-nav-item-wrap">
              <Link prefetch={auxPrefetch} href={item.href} className="site-header-mypage-nav-link">
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
