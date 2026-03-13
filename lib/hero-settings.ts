/**
 * 메인 히어로 전용 설정 타입 및 기본값.
 * SiteSetting.heroSettingsJson 에 JSON 문자열로 저장.
 */
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export type HeroButtonVariant = "primary" | "secondary" | "outline";
export type HeroButtonSize = "small" | "medium" | "large";
export type HeroTextAlign = "left" | "center" | "right";
export type HeroContentVerticalAlign = "top" | "center" | "bottom";
export type HeroButtonsPosition = "belowTitle" | "belowSubtitle" | "bottom";
export type HeroButtonsAlign = "left" | "center" | "right";

export type HeroButtonItem = {
  enabled: boolean;
  label: string;
  href: string;
  size: HeroButtonSize;
  variant: HeroButtonVariant;
  openInNewTab: boolean;
};

export type HeroSettings = {
  heroEnabled: boolean;
  heroBackgroundImageUrl: string | null;
  heroHeightDesktop: string;
  heroHeightMobile: string;
  heroOverlayOpacity: number;
  heroBlurAmount: number;
  heroTextAlign: HeroTextAlign;
  heroContentVerticalAlign: HeroContentVerticalAlign;
  heroEyebrowText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroTitleSize: string;
  heroSubtitleSize: string;
  heroTextMaxWidth: string;
  heroButtonsPosition: HeroButtonsPosition;
  heroButtonsAlign: HeroButtonsAlign;
  heroButtons: [HeroButtonItem, HeroButtonItem, HeroButtonItem];
};

const DEFAULT_BUTTON: HeroButtonItem = {
  enabled: false,
  label: "",
  href: "",
  size: "medium",
  variant: "secondary",
  openInNewTab: false,
};

export const DEFAULT_HERO_SETTINGS: HeroSettings = {
  heroEnabled: true,
  heroBackgroundImageUrl: null,
  heroHeightDesktop: "380px",
  heroHeightMobile: "280px",
  heroOverlayOpacity: 0.4,
  heroBlurAmount: 0,
  heroTextAlign: "center",
  heroContentVerticalAlign: "center",
  heroEyebrowText: "",
  heroTitle: "CAROM.CLUB",
  heroSubtitle: "당구대회 통합 플랫폼",
  heroTitleSize: "2.5rem",
  heroSubtitleSize: "1.125rem",
  heroTextMaxWidth: "42rem",
  heroButtonsPosition: "belowSubtitle",
  heroButtonsAlign: "center",
  heroButtons: [
    { ...DEFAULT_BUTTON, enabled: true, label: "진행중 대회 보기", href: "/tournaments", variant: "primary" },
    { ...DEFAULT_BUTTON, enabled: true, label: "대회 참가 신청", href: "/apply/client", variant: "outline" },
    { ...DEFAULT_BUTTON },
  ],
};

function ensureThreeButtons(buttons: HeroButtonItem[] | undefined): [HeroButtonItem, HeroButtonItem, HeroButtonItem] {
  const b = buttons ?? [];
  return [
    { ...DEFAULT_BUTTON, ...b[0] },
    { ...DEFAULT_BUTTON, ...b[1] },
    { ...DEFAULT_BUTTON, ...b[2] },
  ];
}

export function parseHeroSettingsJson(json: string | null | undefined): HeroSettings | null {
  if (!json || typeof json !== "string" || !json.trim()) return null;
  try {
    const raw = JSON.parse(json) as Partial<HeroSettings>;
    return {
      ...DEFAULT_HERO_SETTINGS,
      ...raw,
      heroButtons: ensureThreeButtons(raw.heroButtons),
    };
  } catch {
    return null;
  }
}

export function getDefaultHeroSettings(): HeroSettings {
  return { ...DEFAULT_HERO_SETTINGS };
}

/** DB에서 히어로 설정 조회. 없거나 파싱 실패 시 null (메인에서는 기존 section/copy 사용) */
export async function getHeroSettings(): Promise<HeroSettings | null> {
  if (!isDatabaseConfigured()) return null;
  try {
    const row = await prisma.siteSetting.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { heroSettingsJson: true },
    });
    return parseHeroSettingsJson(row?.heroSettingsJson ?? null);
  } catch {
    return null;
  }
}

/** 관리자: 히어로 설정 저장 */
export async function updateHeroSettings(settings: HeroSettings): Promise<HeroSettings> {
  if (!isDatabaseConfigured()) return settings;
  const existing = await prisma.siteSetting.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!existing) {
    await prisma.siteSetting.create({
      data: {
        siteName: "CAROM.CLUB",
        primaryColor: "#d97706",
        secondaryColor: "#b91c1c",
        heroSettingsJson: JSON.stringify(settings),
      },
    });
    return settings;
  }
  await prisma.siteSetting.update({
    where: { id: existing.id },
    data: { heroSettingsJson: JSON.stringify(settings) },
  });
  return settings;
}
