/** 관리자에서 선택하는 색상 테마 프리셋 ID */
export const SITE_COLOR_THEME_IDS = ["saas", "dark", "brand", "nature"] as const;
export type SiteColorThemeId = (typeof SITE_COLOR_THEME_IDS)[number];

/** DB·API: 프리셋 4종 외 커스텀 전체 토큰 저장 시 */
export const SITE_CUSTOM_COLOR_THEME_PRESET = "custom" as const;
export type SiteColorThemeMode = SiteColorThemeId | typeof SITE_CUSTOM_COLOR_THEME_PRESET | null;

export type SiteThemeCssTokens = {
  primary: string;
  secondary: string;
  bg: string;
  card: string;
  text: string;
  textMuted: string;
  border: string;
};

type PresetMeta = { label: string; description: string } & SiteThemeCssTokens;

/**
 * 검증된 프리셋만 노출. (직접 HEX 입력 없음)
 * secondary: 보조 버튼·강조 보조에 사용 (기존 --site-secondary).
 */
export const SITE_COLOR_THEME_PRESETS: Record<SiteColorThemeId, PresetMeta> = {
  saas: {
    label: "기본 SaaS",
    description: "블루 포인트·밝은 셸",
    primary: "#2563eb",
    secondary: "#64748b",
    bg: "#ffffff",
    card: "#f8fafc",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#e2e8f0",
  },
  dark: {
    label: "다크",
    description: "다크 배경·라이트 텍스트",
    primary: "#3b82f6",
    secondary: "#38bdf8",
    bg: "#0f172a",
    card: "#1e293b",
    text: "#f1f5f9",
    textMuted: "#94a3b8",
    border: "#334155",
  },
  brand: {
    label: "브랜드",
    description: "레드·앰버 포인트",
    primary: "#ef4444",
    secondary: "#f59e0b",
    bg: "#ffffff",
    card: "#fff7ed",
    text: "#111827",
    textMuted: "#78716c",
    border: "#e7e5e4",
  },
  nature: {
    label: "자연",
    description: "그린 포인트·라이트 그레이",
    primary: "#16a34a",
    secondary: "#15803d",
    bg: "#f9fafb",
    card: "#ffffff",
    text: "#111827",
    textMuted: "#6b7280",
    border: "#e5e7eb",
  },
};

export function isSiteColorThemeId(v: string | null | undefined): v is SiteColorThemeId {
  return v != null && (SITE_COLOR_THEME_IDS as readonly string[]).includes(v);
}

const HEX_6 = /^#([0-9A-Fa-f]{6})$/;
const HEX_3 = /^#([0-9A-Fa-f]{3})$/;

/** #rgb → #rrggbb, 공백 제거 */
export function normalizeHexColor(input: string): string | null {
  const s = input.trim();
  if (HEX_6.test(s)) return s.toLowerCase();
  const m3 = s.match(HEX_3);
  if (m3) {
    const [, h] = m3;
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
  }
  return null;
}

/** `<input type="color">` 용 (#rrggbb) */
export function hexForColorInput(hex: string): string {
  const n = normalizeHexColor(hex);
  return n ?? "#000000";
}

/** API·DB JSON 검증 */
export function parseSiteThemeCustomTokens(input: unknown): SiteThemeCssTokens | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return null;
  const o = input as Record<string, unknown>;
  const keys: (keyof SiteThemeCssTokens)[] = [
    "primary",
    "secondary",
    "bg",
    "card",
    "text",
    "textMuted",
    "border",
  ];
  const out: Partial<SiteThemeCssTokens> = {};
  for (const k of keys) {
    const raw = o[k];
    if (typeof raw !== "string") return null;
    const n = normalizeHexColor(raw);
    if (!n) return null;
    out[k] = n;
  }
  return out as SiteThemeCssTokens;
}

export function tokensFromPreset(id: SiteColorThemeId): SiteThemeCssTokens {
  const p = SITE_COLOR_THEME_PRESETS[id];
  return {
    primary: p.primary,
    secondary: p.secondary,
    bg: p.bg,
    card: p.card,
    text: p.text,
    textMuted: p.textMuted,
    border: p.border,
  };
}

/** 레거시·커스텀: DB primary/secondary만 쓰고 셸은 기본 밝은 톤 */
const LEGACY_SHELL: Omit<SiteThemeCssTokens, "primary" | "secondary"> = {
  bg: "#F6F8FB",
  card: "#FFFFFF",
  text: "#111827",
  textMuted: "#4b5563",
  border: "#E5E7EB",
};

export function resolveSiteThemeCssTokens(settings: {
  colorThemePreset: SiteColorThemeMode;
  colorThemeCustomTokens: SiteThemeCssTokens | null;
  primaryColor: string;
  secondaryColor: string;
}): SiteThemeCssTokens {
  if (
    settings.colorThemePreset === SITE_CUSTOM_COLOR_THEME_PRESET &&
    settings.colorThemeCustomTokens
  ) {
    return settings.colorThemeCustomTokens;
  }
  if (isSiteColorThemeId(settings.colorThemePreset)) {
    const p = SITE_COLOR_THEME_PRESETS[settings.colorThemePreset];
    return {
      primary: p.primary,
      secondary: p.secondary,
      bg: p.bg,
      card: p.card,
      text: p.text,
      textMuted: p.textMuted,
      border: p.border,
    };
  }
  return {
    primary: settings.primaryColor,
    secondary: settings.secondaryColor,
    ...LEGACY_SHELL,
  };
}

export function themePrimarySecondaryForPreset(id: SiteColorThemeId): Pick<SiteThemeCssTokens, "primary" | "secondary"> {
  const p = SITE_COLOR_THEME_PRESETS[id];
  return { primary: p.primary, secondary: p.secondary };
}
