"use client";

import { createContext, useContext, useMemo } from "react";
import type { FooterSettings } from "@/lib/footer-settings";
import type { SiteColorThemeMode, SiteThemeCssTokens } from "@/lib/site-color-themes";

export type SiteSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  colorThemePreset?: SiteColorThemeMode;
  colorThemeCustom?: SiteThemeCssTokens | null;
  /** 메인 대회·당구장 목록 자동 슬라이드(초) — 레이아웃에서 선택적 */
  homeCarouselFlowSpeed?: number;
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
  footer?: FooterSettings;
};

const SiteSettingsContext = createContext<SiteSettings | null>(null);

export function SiteSettingsProvider({
  initial,
  children,
}: {
  initial: SiteSettings;
  children: React.ReactNode;
}) {
  const value = useMemo(() => initial, [initial]);
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings(): SiteSettings {
  const ctx = useContext(SiteSettingsContext);
  return (
    ctx ?? {
      siteName: "CAROM.CLUB",
      siteDescription: null,
      logoUrl: null,
      primaryColor: "#d97706",
      secondaryColor: "#b91c1c",
      colorThemePreset: null,
      colorThemeCustom: null,
      headerBgColor: null,
      headerTextColor: null,
      headerActiveColor: null,
    }
  );
}
