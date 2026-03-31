/**
 * 히어로 타입·기본값·JSON 파싱 (DB/Prisma 없음 — 클라이언트·서버 공용).
 * DB 조회는 `lib/hero-settings.ts`만 사용.
 */

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

/** `ctx.heroSettings` 누락·null 시에도 히어로 슬롯이 동일 컴포넌트로 렌더되도록 */
export function resolveHeroSettingsForSlot(input: HeroSettings | null | undefined): HeroSettings {
  if (input && typeof input === "object") return input;
  return getDefaultHeroSettings();
}
