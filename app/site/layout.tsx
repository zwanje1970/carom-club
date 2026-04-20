import Link from "next/link";
import type { Viewport } from "next";
import { headers } from "next/headers";
import GlobalHomeButton from "../components/GlobalHomeButton";
import SiteRootSwipeNav from "./components/SiteRootSwipeNav";
import SiteVenuesGeolocationNav from "./components/SiteVenuesGeolocationNav";
import { getSiteLayoutConfig, getSiteNotice, type SiteLayoutMenuItem } from "../../lib/server/dev-store";

/** 공개 /site 전용: 핀치 줌·사용자 확대 비허용(루트 viewport와 병합). 플랫폼/클라이언트 레이아웃에는 적용되지 않음 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

function isMobileUserAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return ua.includes("iphone") || ua.includes("android") || ua.includes("ipad") || ua.includes("mobile");
}

/** UA만으로는 잡히지 않는 경우(예: Cursor/데브툴 모바일 뷰) 대비 — Chromium Client Hint */
function isMobileSiteView(headerStore: { get: (name: string) => string | null }): boolean {
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

function SiteHeaderMobile({ menuItems }: { menuItems: SiteLayoutMenuItem[] }) {
  const { main, auxiliary } = splitHeaderMenuItems(menuItems);
  return (
    <header className="site-header">
      <div className="site-header-top">
        <Link className="site-logo" href="/site">
          캐롬클럽
        </Link>
      </div>
      <nav className="site-nav site-nav-mobile" aria-label="사이트 메뉴">
        {main.map((item, index) => (
          <Link
            key={`mobile-main-${index}-${item.href}`}
            href={item.href}
            {...(item.href.startsWith("/site/venues")
              ? {
                  "data-distance-trigger": "true",
                  "data-lat-key": "distanceLat",
                  "data-lng-key": "distanceLng",
                  "data-denied-key": "distanceDenied",
                }
              : {})}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="site-nav-aux site-nav-aux-mobile" aria-label="테스트 진입 메뉴">
        {auxiliary.map((item, index) => (
          <Link key={`mobile-aux-${index}-${item.href}`} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

function SiteHeaderDesktop({ menuItems }: { menuItems: SiteLayoutMenuItem[] }) {
  const { main, auxiliary } = splitHeaderMenuItems(menuItems);
  return (
    <header className="site-header">
      <div className="site-header-top site-header-top-desktop">
        <Link className="site-logo" href="/site">
          캐롬클럽
        </Link>
        <nav className="site-nav site-nav-desktop" aria-label="사이트 메뉴">
          {main.map((item, index) => (
            <Link
              key={`desktop-main-${index}-${item.href}`}
              href={item.href}
              {...(item.href.startsWith("/site/venues")
                ? {
                    "data-distance-trigger": "true",
                    "data-lat-key": "distanceLat",
                    "data-lng-key": "distanceLng",
                    "data-denied-key": "distanceDenied",
                  }
                : {})}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="site-nav-aux site-nav-aux-desktop" aria-label="테스트 진입 메뉴">
          {auxiliary.map((item, index) => (
            <Link key={`desktop-aux-${index}-${item.href}`} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function SiteFooterMobile({ text }: { text: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return (
    <footer className="site-footer">
      {lines.map((line, index) => (
        <p key={`mobile-footer-line-${index}`} className={index === 0 ? undefined : "site-footer-muted"}>
          {line}
        </p>
      ))}
    </footer>
  );
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

export default async function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const isMobile = isMobileSiteView(headerStore);
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

  if (isMobile || isPageBuilderPreviewRequest) {
    return (
      <div className="site-shell">
        <SiteVenuesGeolocationNav />
        {children}
        <SiteRootSwipeNav />
        <GlobalHomeButton />
      </div>
    );
  }

  return (
    <div className="site-shell site-shell--pc-sticky-footer">
      <SiteVenuesGeolocationNav />
      <SiteHeaderDesktop menuItems={config.header.pc.menuItems} />
      <div className="site-shell-main">{children}</div>
      <SiteFooterDesktop text={config.footer.pc.text} />
      <SiteRootSwipeNav />
      <GlobalHomeButton />
    </div>
  );
}
