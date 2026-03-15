import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { AdminFloatButton } from "@/components/AdminFloatButton";
import NotificationBanner from "@/components/NotificationBanner";
import { RegisterServiceWorker } from "@/components/push/RegisterServiceWorker";
import { getSiteSettings, DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/site-settings";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { SiteThemeStyles } from "@/components/SiteThemeStyles";
import { ClientPerfLogger } from "@/components/ClientPerfLogger";
import { SITE_NAME, DEFAULT_SITE_URL } from "@/lib/site-settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL;
}

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = getSiteUrl();
  try {
    const settings = await getSiteSettings();
    const title = settings.siteName || SITE_NAME;
    const description =
      settings.siteDescription || "당구 대회, 모임, 레슨을 한 곳에서.";
    return {
      title,
      description,
      metadataBase: new URL(baseUrl),
      icons: {
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%231a1a2e' width='32' height='32' rx='6'/%3E%3Ctext x='16' y='22' text-anchor='middle' fill='%23fff' font-size='18' font-weight='bold' font-family='system-ui'%3EC%3C/text%3E%3C/svg%3E",
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
        icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect fill='%231a1a2e' width='32' height='32' rx='6'/%3E%3Ctext x='16' y='22' text-anchor='middle' fill='%23fff' font-size='18' font-weight='bold' font-family='system-ui'%3EC%3C/text%3E%3C/svg%3E",
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
  try {
    settings = await getSiteSettings();
  } catch {
    // use defaults
  }

  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        {/* 웹폰트: Google Fonts는 display=swap 적용. CDN 폰트는 초기 렌더 후 로드 권장. */}
        <link
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
          rel="stylesheet"
        />
        <link
          href="https://spoqa.github.io/spoqa-han-sans/css/SpoqaHanSansNeo.css"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Nanum+Gothic&family=Nanum+Myeongjo&family=Black+Han+Sans&family=Do+Hyeon&family=Gothic+A1:wght@400;700&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
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
          <IntroRoot>
            <MainSiteHeaderWrapper />
            <MobileBottomNavWrapper>{children}</MobileBottomNavWrapper>
          </IntroRoot>
          <AdminFloatButton />
        </SiteSettingsProvider>
      </body>
    </html>
  );
}

