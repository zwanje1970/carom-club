import { headers } from "next/headers";
import GlobalHomeButton from "../components/GlobalHomeButton";
import SiteChromeHeader, { isPublicSiteMobileView } from "./components/SiteChromeHeader";
import SiteRootSwipeNav from "./components/SiteRootSwipeNav";
import SiteVenuesGeolocationNav from "./components/SiteVenuesGeolocationNav";
import { getSiteLayoutConfig } from "../../lib/surface-read";
import { filterPcHeaderAdminMenuItems, getPcSiteHeaderAdminFlags } from "./lib/site-pc-header-admin";
import { isSiteMainSamplePathname } from "./lib/site-main-sample";

/** `/site/main-sample` — `next-url` 등 헤더 기준(클라이언트는 `GlobalHomeButton`에서 `usePathname`으로 보강) */
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

function SiteFooterDesktop({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return (
    <footer className="site-footer">
      <div className="site-footer-desktop">
        {lines.map((line, index) => (
          <p key={`desktop-footer-line-${index}`} className={index === 0 ? undefined : "site-footer-muted"}>
            {line}
          </p>
        ))}
      </div>
    </footer>
  );
}

/** `/`·`/site` 공통 — 공개 사이트 상·하단 크롬(헤더·본문 래퍼·푸터) */
export default async function SitePublicChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const isMobile = isPublicSiteMobileView(headerStore);
  const config = await getSiteLayoutConfig();
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

  if (isMobile || isPageBuilderPreviewRequest) {
    return (
      <div className={`site-shell site-shell--ua-mobile-site${siteShellSampleClass}`}>
        <SiteVenuesGeolocationNav />
        {isSiteMainSample ? null : (
          <div className="site-shell-pc-header">
            <SiteChromeHeader menuItems={config.header.mobile.menuItems} />
          </div>
        )}
        <SiteRootSwipeNav>{children}</SiteRootSwipeNav>
        <GlobalHomeButton />
      </div>
    );
  }

  const pcAdminEntry = await getPcSiteHeaderAdminFlags();
  const pcHeaderMenuItems = filterPcHeaderAdminMenuItems(config.header.pc.menuItems);

  return (
    <div className={`site-shell site-shell--pc-sticky-footer site-shell--pc-site-chrome${siteShellSampleClass}`}>
      <div className="site-shell-pc-constrain">
        <SiteVenuesGeolocationNav />
        {isSiteMainSample ? null : (
          <SiteChromeHeader menuItems={pcHeaderMenuItems} pcAdminEntry={pcAdminEntry} />
        )}
        <div className="site-shell-main">{children}</div>
        <SiteFooterDesktop text={config.footer.pc.text} />
      </div>
      <SiteRootSwipeNav />
      <GlobalHomeButton />
    </div>
  );
}
