"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  dashboardMobileChromeMeta,
  type DashboardArea,
} from "../../lib/dashboard-mobile-route-meta";

export default function DashboardMobileChromeBar({ area }: { area: DashboardArea }) {
  const pathname = usePathname() ?? "";
  const { title, backHref } = dashboardMobileChromeMeta(pathname, area);

  return (
    <header
      className="site-home-top-white site-home-top-white--standard app-dashboard-mobile-chrome"
      aria-label="페이지 상단"
    >
      <div className="site-home-brand app-dashboard-mobile-chrome__inner">
        <div className="app-dashboard-mobile-chrome__side app-dashboard-mobile-chrome__side--start">
          {backHref ? (
            <Link href={backHref} className="app-dashboard-mobile-chrome__back" aria-label="뒤로">
              ←
            </Link>
          ) : (
            <span className="app-dashboard-mobile-chrome__side-spacer" aria-hidden />
          )}
        </div>
        <div className="site-mobile-page-title-block app-dashboard-mobile-chrome__title">{title}</div>
        <div className="app-dashboard-mobile-chrome__side app-dashboard-mobile-chrome__side--end" aria-hidden>
          <span className="app-dashboard-mobile-chrome__side-spacer" />
        </div>
      </div>
    </header>
  );
}
