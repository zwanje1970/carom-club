import type { Metadata, Viewport } from "next";
import "./globals.css";
import { pretendard } from "./fonts";
import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { GlobalChromeModeProvider } from "@/components/community/BallPlacementFullscreenContext";
import { AdminFloatButton } from "@/components/AdminFloatButton";
import { ClientFloatButton } from "@/components/ClientFloatButton";
import NotificationBanner from "@/components/NotificationBanner";
import { RegisterServiceWorker } from "@/components/push/RegisterServiceWorker";
import { getCommonGlobalData } from "@/lib/common-page-data";
import { getSession } from "@/lib/auth";
import { canShowNoteEntry } from "@/lib/entry-visibility";
import { isPlatformAdmin } from "@/types/auth";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { SiteThemeStyles } from "@/components/SiteThemeStyles";
import { ClientPerfLogger } from "@/components/ClientPerfLogger";
import { SITE_NAME, DEFAULT_SITE_URL } from "@/lib/site-settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#000000",
};

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getSiteUrl();
  try {
    const { siteSettings } = await getCommonGlobalData();
    const title = siteSettings.siteName || SITE_NAME;
    const description =
      siteSettings.siteDescription || "당구 대회, 모임, 레슨을 한 곳에서.";
    return {
      title,
      description,
      metadataBase: new URL(baseUrl),
      icons: {
        icon: "/icons/app-icon.png",
        apple: "/icons/app-icon.png",
      },
      openGraph: {
        title,
        description,
        url: baseUrl,
      },
    };
  } catch {
    return {
      title: SITE_NAME,
      description: "당구 대회, 모임, 레슨을 한 곳에서.",
      metadataBase: new URL(baseUrl),
      icons: {
        icon: "/icons/app-icon.png",
        apple: "/icons/app-icon.png",
      },
      openGraph: {
        title: SITE_NAME,
        description: "당구 대회, 모임, 레슨을 한 곳에서.",
        url: baseUrl,
      },
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let settings = {
    siteName: SITE_NAME,
    siteDescription: null as string | null,
    logoUrl: null as string | null,
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
    withdrawRejoinDays: 0,
    headerBgColor: null as string | null,
    headerTextColor: null as string | null,
    headerActiveColor: null as string | null,
  };

  const [globalData, session] = await Promise.all([
    getCommonGlobalData().catch(() => null),
    getSession(),
  ]);

  if (globalData) {
    settings = globalData.siteSettings;
  }

  const showMainSiteNoteEntry = canShowNoteEntry(isPlatformAdmin(session));

  return (
    <html
      lang="ko"
      className={`scroll-smooth ${pretendard.variable}`}
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icons/app-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body className="min-h-screen antialiased">
        <SiteThemeStyles
          primaryColor={settings.primaryColor ?? DEFAULT_PRIMARY_COLOR}
          secondaryColor={settings.secondaryColor ?? DEFAULT_SECONDARY_COLOR}
        />
        <SiteSettingsProvider initial={settings}>
          <ClientPerfLogger />
          <RegisterServiceWorker />
          <NotificationBanner />
          <GlobalChromeModeProvider>
            <IntroRoot>
              <MainSiteHeaderWrapper />
              <MobileBottomNavWrapper showMainSiteNoteEntry={showMainSiteNoteEntry}>
                {children}
              </MobileBottomNavWrapper>
            </IntroRoot>
          </GlobalChromeModeProvider>
          <AdminFloatButton />
          <ClientFloatButton />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
