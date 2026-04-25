import { headers } from "next/headers";

import { getSiteLayoutConfig } from "../../../lib/surface-read";
import { getSiteUnreadNotificationCount } from "../../../lib/server/site-unread-notification-count";
import { filterPcHeaderAdminMenuItems, getPcSiteHeaderAdminFlags } from "../lib/site-pc-header-admin";
import SiteChromeHeader, { isPublicSiteMobileView } from "./SiteChromeHeader";
import SiteVenuesGeolocationNav from "./SiteVenuesGeolocationNav";

/** `/platform`·`/client` PC 대시보드 — 공개 사이트와 동일 `SiteChromeHeader` 재사용 (모바일 UA에서는 null) */
export default async function SitePcDashboardChromeShell() {
  const headerStore = await headers();
  if (isPublicSiteMobileView(headerStore)) return null;

  const siteConfig = await getSiteLayoutConfig();
  const unreadNotificationCount = await getSiteUnreadNotificationCount();
  const pcAdminEntry = await getPcSiteHeaderAdminFlags();
  const pcHeaderMenuItems = filterPcHeaderAdminMenuItems(siteConfig.header.pc.menuItems);

  return (
    <div className="site-shell site-shell--pc-site-chrome site-shell--dashboard-chrome-header">
      <div className="site-shell-pc-constrain">
        <SiteVenuesGeolocationNav />
        <SiteChromeHeader
          menuItems={pcHeaderMenuItems}
          unreadNotificationCount={unreadNotificationCount}
          pcAdminEntry={pcAdminEntry}
        />
      </div>
    </div>
  );
}
