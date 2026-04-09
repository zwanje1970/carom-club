import type { Metadata, Viewport } from "next";
import "./globals.css";
import { DEFAULT_PRIMARY_COLOR, DEFAULT_SECONDARY_COLOR } from "@/lib/site-settings";
import {
  resolveSiteThemeCssTokens,
  type SiteColorThemeMode,
  type SiteThemeCssTokens,
} from "@/lib/site-color-themes";
import { SiteSettingsProvider } from "@/components/SiteSettingsProvider";
import { SiteThemeStyles } from "@/components/SiteThemeStyles";
import { SITE_NAME, DEFAULT_SITE_URL } from "@/lib/site-settings";
import { getSiteSettings } from "@/lib/site-settings";
import { RootLayoutChrome } from "./RootLayoutChrome";

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
    const siteSettings = await getSiteSettings();
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
    colorThemePreset: null as SiteColorThemeMode,
    colorThemeCustom: null as SiteThemeCssTokens | null,
    withdrawRejoinDays: 0,
    headerBgColor: null as string | null,
    headerTextColor: null as string | null,
    headerActiveColor: null as string | null,
    mobileHeaderBgColor: null as string | null,
    mobileHeaderTextColor: null as string | null,
    mobileHeaderActiveColor: null as string | null,
    mobileHeaderLogoText: null as string | null,
  };

  const siteSettings = await getSiteSettings().catch(() => null);
  if (siteSettings) {
    settings = siteSettings;
  }

  const themeTokens = resolveSiteThemeCssTokens({
    colorThemePreset: settings.colorThemePreset ?? null,
    colorThemeCustomTokens: settings.colorThemeCustom ?? null,
    primaryColor: settings.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    secondaryColor: settings.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
  });

  return (
    <html lang="ko" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <link rel="apple-touch-icon" href="/icons/app-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body className="min-h-screen antialiased">
        <SiteThemeStyles
          tokens={themeTokens}
          headerBgColor={settings.headerBgColor}
          headerTextColor={settings.headerTextColor}
          headerActiveColor={settings.headerActiveColor}
        />
        <SiteSettingsProvider initial={settings}>
          <RootLayoutChrome>{children}</RootLayoutChrome>
        </SiteSettingsProvider>
      </body>
    </html>
  );
}
