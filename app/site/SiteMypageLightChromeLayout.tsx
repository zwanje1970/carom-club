import Link from "next/link";
import { headers } from "next/headers";
import GlobalHomeButton from "../components/GlobalHomeButton";
import { isPublicSiteMobileView } from "./components/site-public-mobile-view";
import SiteRootSwipeNav from "./components/SiteRootSwipeNav";
import SiteVenuesGeolocationNav from "./components/SiteVenuesGeolocationNav";
import { isSiteMainSamplePathname } from "./lib/site-main-sample";

function pathnameIndicatesSiteMainSample(nextUrlHeader: string): boolean {
  const raw = nextUrlHeader.trim();
  if (!raw) return false;
  try {
    const pathname = raw.startsWith("http") ? new URL(raw).pathname : raw.split("?")[0] ?? raw;
    return isSiteMainSamplePathname(pathname);
  } catch {
    return isSiteMainSamplePathname(raw);
  }
}

/**
 * `/site/mypage/*` 전용: `getSiteLayoutConfig`·PC 관리자 헤더 플래그·전체 `SiteChromeHeader` 없이
 * 동일 `site-shell` 계열만 유지(하단 5탭·루트 스와이프 래퍼). 홈은 로고 링크만.
 */
export default async function SiteMypageLightChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const isMobile = isPublicSiteMobileView(headerStore);
  const siteBuilderPreviewHeader = headerStore.get("x-site-builder-preview");
  const nextUrlHeader =
    headerStore.get("next-url") ??
    headerStore.get("x-invoke-path") ??
    headerStore.get("x-matched-path") ??
    "";
  const isPreviewPathRequest = nextUrlHeader.startsWith("/site/preview");
  const isPageBuilderPreviewRequest =
    siteBuilderPreviewHeader === "1" ||
    isPreviewPathRequest ||
    (headerStore.get("referer") ?? "").includes("/platform/site/pages") ||
    (headerStore.get("referer") ?? "").includes("/platform/site/page-builder") ||
    (headerStore.get("referer") ?? "").includes("/admin/site/page-builder");

  const isSiteMainSample = pathnameIndicatesSiteMainSample(nextUrlHeader);
  const siteShellSampleClass = isSiteMainSample ? " site-shell--site-main-sample" : "";

  const minimalHeaderInner = isSiteMainSample ? null : (
    <header className="site-header">
      <div className="site-header-top">
        <Link prefetch={false} className="site-logo" href="/site">
          <span className="site-header-logo-dots" aria-hidden="true">
            <span className="site-header-logo-dot site-header-logo-dot--y">●</span>
            <span className="site-header-logo-dot site-header-logo-dot--r">●</span>
            <span className="site-header-logo-dot site-header-logo-dot--w">●</span>
          </span>
          캐롬클럽
        </Link>
      </div>
    </header>
  );

  const mobileTopChrome =
    minimalHeaderInner != null ? <div className="site-shell-pc-header">{minimalHeaderInner}</div> : null;

  if (isMobile || isPageBuilderPreviewRequest) {
    return (
      <div className={`site-shell site-shell--ua-mobile-site${siteShellSampleClass}`}>
        <SiteVenuesGeolocationNav />
        {mobileTopChrome}
        <SiteRootSwipeNav>{children}</SiteRootSwipeNav>
        <GlobalHomeButton />
      </div>
    );
  }

  return (
    <div className={`site-shell site-shell--pc-sticky-footer site-shell--pc-site-chrome${siteShellSampleClass}`}>
      <div className="site-shell-pc-constrain">
        <SiteVenuesGeolocationNav />
        {minimalHeaderInner}
        <div className="site-shell-main">{children}</div>
        <footer className="site-footer" aria-label="사이트 정보">
          <div className="site-footer-desktop">
            <p>캐롬클럽</p>
          </div>
        </footer>
      </div>
      <SiteRootSwipeNav />
      <GlobalHomeButton />
    </div>
  );
}
