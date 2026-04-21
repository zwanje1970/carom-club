import GlobalHomeButton from "../components/GlobalHomeButton";
import SitePcDashboardChromeShell from "../site/components/SitePcDashboardChromeShell";

export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <SitePcDashboardChromeShell />
      <div className="app-mobile-bottom-nav-scroll-pad">{children}</div>
      <GlobalHomeButton />
    </>
  );
}
