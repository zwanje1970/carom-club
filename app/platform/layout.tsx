import type { Viewport } from "next";
import DashboardMobileChromeLayout from "../components/DashboardMobileChromeLayout";
import GlobalHomeButton from "../components/GlobalHomeButton";
import SitePcDashboardChromeShell from "../site/components/SitePcDashboardChromeShell";

export const viewport: Viewport = {
  themeColor: "#4d7db5",
};

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SitePcDashboardChromeShell />
      <DashboardMobileChromeLayout area="platform">
        <div className="app-mobile-bottom-nav-scroll-pad app-dashboard-shell app-dashboard-shell--with-mobile-chrome">
          {children}
        </div>
      </DashboardMobileChromeLayout>
      <GlobalHomeButton />
    </>
  );
}
