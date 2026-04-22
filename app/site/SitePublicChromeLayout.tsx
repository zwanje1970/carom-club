import { headers } from "next/headers";
import GlobalHomeButton from "../components/GlobalHomeButton";
import SiteChromeHeader, { isPublicSiteMobileView } from "./components/SiteChromeHeader";
import SiteRootSwipeNav from "./components/SiteRootSwipeNav";
import SiteVenuesGeolocationNav from "./components/SiteVenuesGeolocationNav";
import { getSiteLayoutConfig, getSiteNotice } from "../../lib/server/dev-store";
import { getSiteUnreadNotificationCount } from "../../lib/server/site-unread-notification-count";
import { filterPcHeaderAdminMenuItems, getPcSiteHeaderAdminFlags } from "./lib/site-pc-header-admin";

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
  const referer = headerStore.get("referer") ?? "";
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
    referer.includes("/platform/site/pages") ||
    referer.includes("/platform/site/page-builder") ||
    referer.includes("/admin/site/page-builder");
  const config = await getSiteLayoutConfig();
  let siteNotice = { enabled: false, text: "" };
  try {
    siteNotice = await getSiteNotice();
  } catch {
    siteNotice = { enabled: false, text: "" };
  }
  void siteNotice;

  const unreadNotificationCount = await getSiteUnreadNotificationCount();

  if (isMobile || isPageBuilderPreviewRequest) {
    return (
      <div className="site-shell site-shell--ua-mobile-site">
        <SiteVenuesGeolocationNav />
        <div className="site-shell-pc-header">
          <SiteChromeHeader menuItems={config.header.pc.menuItems} unreadNotificationCount={unreadNotificationCount} />
        </div>
        <SiteRootSwipeNav>{children}</SiteRootSwipeNav>
        <GlobalHomeButton />
      </div>
    );
  }

  const pcAdminEntry = await getPcSiteHeaderAdminFlags();
  const pcHeaderMenuItems = filterPcHeaderAdminMenuItems(config.header.pc.menuItems);

  return (
    <div className="site-shell site-shell--pc-sticky-footer site-shell--pc-site-chrome">
      <div className="site-shell-pc-constrain">
        <SiteVenuesGeolocationNav />
        <SiteChromeHeader
          menuItems={pcHeaderMenuItems}
          unreadNotificationCount={unreadNotificationCount}
          pcAdminEntry={pcAdminEntry}
        />
        <div className="site-shell-main">{children}</div>
        <SiteFooterDesktop text={config.footer.pc.text} />
      </div>
      <SiteRootSwipeNav />
      <GlobalHomeButton />
    </div>
  );
}
