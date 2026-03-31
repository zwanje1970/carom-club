import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  type FooterSettings,
  dbRowToFooterSettings,
  footerPartnersToJson,
  footerFontSizesToJson,
  footerFontFamiliesToJson,
} from "@/lib/footer-settings";
import { clampFlowSpeed } from "@/lib/home-carousel-flow";
import {
  isSiteColorThemeId,
  SITE_CUSTOM_COLOR_THEME_PRESET,
  parseSiteThemeCustomTokens,
  themePrimarySecondaryForPreset,
  type SiteColorThemeMode,
  type SiteThemeCssTokens,
} from "@/lib/site-color-themes";

/** 사이트 영문 브랜드명 */
export const SITE_NAME = "CAROM.CLUB";
/** 사이트 한글 서비스명 */
export const SITE_NAME_KO = "캐롬클럽";
/** 기본 도메인 (NEXT_PUBLIC_SITE_URL 없을 때 사용) */
export const DEFAULT_SITE_URL = "https://carom.club";

/** 테마 메인 색상 기본값 (어두운 톤). CSS 변수 --site-primary / Tailwind site-primary 와 동일한 값 사용 */
export const DEFAULT_PRIMARY_COLOR = "#991b1b";
/** 테마 보조 색상 기본값 (어두운 톤). CSS 변수 --site-secondary / Tailwind site-secondary 와 동일한 값 사용 */
export const DEFAULT_SECONDARY_COLOR = "#78350f";

export type SiteSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  /** null: 레거시(primary/secondary만·기본 셸). custom: colorThemeCustom 토큰 전체 */
  colorThemePreset: SiteColorThemeMode;
  /** colorThemePreset === custom 일 때만 유효 */
  colorThemeCustom: SiteThemeCssTokens | null;
  withdrawRejoinDays: number;
  /** 메인 진행중 대회·당구장 가로 흐름 속도(1~100) */
  homeCarouselFlowSpeed: number;
  /** 일반회원(USER) 난구해결사 해법 등록 최소 LEVEL */
  minSolutionLevelForUser: number;
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
  introSettings: IntroSettings;
  footer: FooterSettings;
};

export type IntroSettings = {
  enabled: boolean;
  title: string;
  description: string;
  mediaType: "image" | "video";
  mediaUrl: string;
  linkUrl: string | null;
  displaySeconds: number;
  showSkipButton: boolean;
};

const DEFAULTS: SiteSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
  colorThemePreset: null,
  colorThemeCustom: null,
  withdrawRejoinDays: 0,
  homeCarouselFlowSpeed: 50,
  minSolutionLevelForUser: 1,
  headerBgColor: null,
  headerTextColor: null,
  headerActiveColor: null,
  introSettings: {
    enabled: false,
    title: "CAROM.CLUB",
    description: "",
    mediaType: "image",
    mediaUrl: "",
    linkUrl: null,
    displaySeconds: 4,
    showSkipButton: true,
  },
  footer: {
    footerEnabled: false,
    footerBgColor: null,
    footerTextColor: null,
    footerTitle: null,
    footerCompanyName: null,
    footerBusinessNumber: null,
    footerCeoName: null,
    footerAddress: null,
    footerPhone: null,
    footerEmail: null,
    footerCopyright: null,
    footerFontSize: null,
    footerFontSizes: {},
    footerFontFamilies: {},
    footerPartners: [],
  },
};

async function getSiteSettingsUncached(): Promise<SiteSettings> {
  if (!isDatabaseConfigured()) {
    return DEFAULTS;
  }
  try {
    const row = await prisma.siteSetting.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    if (!row) {
      const created = await prisma.siteSetting.create({
        data: {
          siteName: DEFAULTS.siteName,
          primaryColor: DEFAULTS.primaryColor,
          secondaryColor: DEFAULTS.secondaryColor,
        },
      });
      return dbRowToSettings(created);
    }
    const fullRow = await querySiteSettingFullRowById(row.id);
    return dbRowToSettings(fullRow ?? row);
  } catch {
    return DEFAULTS;
  }
}

/** 60초 캐시. 레이아웃·공통 데이터와 함께 반복 요청 시 캐시에서 반환. */
export async function getSiteSettings(): Promise<SiteSettings> {
  return unstable_cache(getSiteSettingsUncached, ["site-settings"], {
    revalidate: 60,
    tags: ["site-settings", "common-page-data"],
  })();
}

type SiteSettingRow = {
  id?: string;
  updatedAt?: Date;
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  colorThemePreset?: string | null;
  colorThemeCustomJson?: string | null;
  introSettingsJson?: string | null;
  withdrawRejoinDays?: number;
  homeCarouselFlowSpeed?: number;
  minSolutionLevelForUser?: number;
  headerBgColor?: string | null;
  headerTextColor?: string | null;
  headerActiveColor?: string | null;
  footerEnabled?: boolean | null;
  footerBgColor?: string | null;
  footerTextColor?: string | null;
  footerTitle?: string | null;
  footerCompanyName?: string | null;
  footerBusinessNumber?: string | null;
  footerCeoName?: string | null;
  footerAddress?: string | null;
  footerPhone?: string | null;
  footerEmail?: string | null;
  footerCopyright?: string | null;
  footerFontSize?: string | null;
  footerFontSizesJson?: string | null;
  footerFontFamiliesJson?: string | null;
  footerPartnersJson?: string | null;
  heroSettingsJson?: string | null;
};

/**
 * Neon pooler(PgBouncer) + prepared statement: `SELECT *` 는 컬럼 추가 후
 * 동일 이름의 prepared plan이 예전 결과 타입을 기대해
 * `cached plan must not change result type` 가 날 수 있다. 컬럼을 고정한다.
 * (`SiteSetting` 에 컬럼이 생기면 마이그레이션과 함께 이 목록을 갱신)
 */
async function querySiteSettingFullRowById(id: string): Promise<SiteSettingRow | null> {
  try {
    const rows = await prisma.$queryRaw<SiteSettingRow[]>`
      SELECT
        "id",
        "siteName",
        "siteDescription",
        "logoUrl",
        "primaryColor",
        "secondaryColor",
        "updatedAt",
        "heroSettingsJson",
        "withdrawRejoinDays",
        "footerAddress",
        "footerBgColor",
        "footerBusinessNumber",
        "footerCeoName",
        "footerCompanyName",
        "footerCopyright",
        "footerEmail",
        "footerEnabled",
        "footerPartnersJson",
        "footerPhone",
        "footerTextColor",
        "footerTitle",
        "headerActiveColor",
        "headerBgColor",
        "headerTextColor",
        "introSettingsJson",
        "footerFontSize",
        "footerFontSizesJson",
        "footerFontFamiliesJson",
        "homeCarouselFlowSpeed",
        "minSolutionLevelForUser",
        "colorThemePreset",
        "colorThemeCustomJson"
      FROM "SiteSetting"
      WHERE "id" = ${id}
    `;
    return rows[0] ?? null;
  } catch {
    const rows = await prisma.$queryRaw<SiteSettingRow[]>`
      SELECT
        "id",
        "siteName",
        "siteDescription",
        "logoUrl",
        "primaryColor",
        "secondaryColor",
        "updatedAt",
        "heroSettingsJson",
        "withdrawRejoinDays",
        "footerAddress",
        "footerBgColor",
        "footerBusinessNumber",
        "footerCeoName",
        "footerCompanyName",
        "footerCopyright",
        "footerEmail",
        "footerEnabled",
        "footerPartnersJson",
        "footerPhone",
        "footerTextColor",
        "footerTitle",
        "headerActiveColor",
        "headerBgColor",
        "headerTextColor",
        "footerFontSize",
        "footerFontSizesJson",
        "footerFontFamiliesJson",
        "homeCarouselFlowSpeed",
        "minSolutionLevelForUser",
        "colorThemePreset",
        "colorThemeCustomJson"
      FROM "SiteSetting"
      WHERE "id" = ${id}
    `;
    const row = rows[0] ?? null;
    if (!row) return null;
    return { ...row, introSettingsJson: null };
  }
}

type ThemeExisting = {
  primaryColor: string;
  secondaryColor: string;
  colorThemePreset: SiteColorThemeMode;
} | null;

function presetAndCustomFromRow(row: SiteSettingRow): {
  colorThemePreset: SiteColorThemeMode;
  colorThemeCustom: SiteThemeCssTokens | null;
} {
  const presetRaw = row.colorThemePreset ?? null;
  if (presetRaw === SITE_CUSTOM_COLOR_THEME_PRESET) {
    try {
      const parsed = row.colorThemeCustomJson
        ? parseSiteThemeCustomTokens(JSON.parse(row.colorThemeCustomJson))
        : null;
      if (parsed) {
        return {
          colorThemePreset: SITE_CUSTOM_COLOR_THEME_PRESET,
          colorThemeCustom: parsed,
        };
      }
    } catch {
      /* fall through */
    }
    return { colorThemePreset: null, colorThemeCustom: null };
  }
  if (isSiteColorThemeId(presetRaw)) {
    return { colorThemePreset: presetRaw, colorThemeCustom: null };
  }
  return { colorThemePreset: null, colorThemeCustom: null };
}

function normalizeIntroSettings(input: unknown): IntroSettings {
  if (!input || typeof input !== "object") return DEFAULTS.introSettings;
  const raw = input as Record<string, unknown>;
  const mediaType = raw.mediaType === "video" ? "video" : "image";
  const displaySeconds = Math.max(1, Math.min(30, Math.floor(Number(raw.displaySeconds)) || 4));
  return {
    enabled: Boolean(raw.enabled),
    title: typeof raw.title === "string" ? raw.title : DEFAULTS.introSettings.title,
    description: typeof raw.description === "string" ? raw.description : "",
    mediaType,
    mediaUrl: typeof raw.mediaUrl === "string" ? raw.mediaUrl : "",
    linkUrl: typeof raw.linkUrl === "string" && raw.linkUrl.trim() ? raw.linkUrl : null,
    displaySeconds,
    showSkipButton: raw.showSkipButton === undefined ? true : Boolean(raw.showSkipButton),
  };
}

/** 색상 테마 프리셋·커스텀 JSON·수동 primary/secondary 병합 (PUT 본문 기준) */
function mergeThemePatch(
  data: Partial<Omit<SiteSettings, "footer">>,
  existing: ThemeExisting
): {
  colorThemePreset?: SiteColorThemeMode;
  colorThemeCustomJson?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
} {
  const out: {
    colorThemePreset?: SiteColorThemeMode;
    colorThemeCustomJson?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
  } = {};

  if (data.colorThemePreset !== undefined) {
    if (data.colorThemePreset === null) {
      out.colorThemePreset = null;
      out.colorThemeCustomJson = null;
      if (data.primaryColor !== undefined) out.primaryColor = data.primaryColor;
      if (data.secondaryColor !== undefined) out.secondaryColor = data.secondaryColor;
      return out;
    }
    if (data.colorThemePreset === SITE_CUSTOM_COLOR_THEME_PRESET) {
      const parsed =
        data.colorThemeCustom != null ? parseSiteThemeCustomTokens(data.colorThemeCustom) : null;
      if (!parsed) {
        return out;
      }
      out.colorThemePreset = SITE_CUSTOM_COLOR_THEME_PRESET;
      out.colorThemeCustomJson = JSON.stringify(parsed);
      out.primaryColor = parsed.primary;
      out.secondaryColor = parsed.secondary;
      return out;
    }
    if (isSiteColorThemeId(data.colorThemePreset)) {
      out.colorThemePreset = data.colorThemePreset;
      out.colorThemeCustomJson = null;
      const ps = themePrimarySecondaryForPreset(data.colorThemePreset);
      out.primaryColor = ps.primary;
      out.secondaryColor = ps.secondary;
      return out;
    }
    return out;
  }

  if (data.primaryColor !== undefined || data.secondaryColor !== undefined) {
    const primaryChanged =
      data.primaryColor !== undefined &&
      (existing == null || data.primaryColor !== existing.primaryColor);
    const secondaryChanged =
      data.secondaryColor !== undefined &&
      (existing == null || data.secondaryColor !== existing.secondaryColor);
    if (primaryChanged || secondaryChanged) {
      out.colorThemePreset = null;
      out.colorThemeCustomJson = null;
    }
    if (data.primaryColor !== undefined) out.primaryColor = data.primaryColor;
    if (data.secondaryColor !== undefined) out.secondaryColor = data.secondaryColor;
  }

  return out;
}

function dbRowToSettings(row: SiteSettingRow): SiteSettings {
  const footer = dbRowToFooterSettings(row as Parameters<typeof dbRowToFooterSettings>[0]);
  const minSolutionLevelForUser = Math.min(
    15,
    Math.max(1, Math.floor(Number(row.minSolutionLevelForUser ?? DEFAULTS.minSolutionLevelForUser)) || 1)
  );
  const { colorThemePreset, colorThemeCustom } = presetAndCustomFromRow(row);
  let introSettings = DEFAULTS.introSettings;
  try {
    const parsed = row.introSettingsJson ? JSON.parse(row.introSettingsJson) : null;
    introSettings = normalizeIntroSettings(parsed);
  } catch {
    introSettings = DEFAULTS.introSettings;
  }
  return {
    siteName: row.siteName,
    siteDescription: row.siteDescription,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    colorThemePreset,
    colorThemeCustom,
    withdrawRejoinDays: row.withdrawRejoinDays ?? 0,
    homeCarouselFlowSpeed: clampFlowSpeed(row.homeCarouselFlowSpeed),
    minSolutionLevelForUser,
    headerBgColor: row.headerBgColor ?? null,
    headerTextColor: row.headerTextColor ?? null,
    headerActiveColor: row.headerActiveColor ?? null,
    introSettings,
    footer,
  };
}

export async function updateSiteSettings(
  data: Partial<Omit<SiteSettings, "footer">>
): Promise<SiteSettings> {
  if (!isDatabaseConfigured()) {
    const themePatch = mergeThemePatch(data, null);
    return {
      ...DEFAULTS,
      ...data,
      ...themePatch,
      introSettings: data.introSettings ? normalizeIntroSettings(data.introSettings) : DEFAULTS.introSettings,
    };
  }
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  const headerPayload =
    data.headerBgColor !== undefined ||
    data.headerTextColor !== undefined ||
    data.headerActiveColor !== undefined
      ? {
          headerBgColor: data.headerBgColor ?? null,
          headerTextColor: data.headerTextColor ?? null,
          headerActiveColor: data.headerActiveColor ?? null,
        }
      : null;
  const minSolutionLevelForUser =
    data.minSolutionLevelForUser !== undefined
      ? Math.min(15, Math.max(1, Math.floor(Number(data.minSolutionLevelForUser)) || 1))
      : undefined;
  const headerBgColor = headerPayload?.headerBgColor ?? null;
  const headerTextColor = headerPayload?.headerTextColor ?? null;
  const headerActiveColor = headerPayload?.headerActiveColor ?? null;
  const introSettingsJson =
    data.introSettings !== undefined
      ? JSON.stringify(normalizeIntroSettings(data.introSettings))
      : undefined;

  const existingRow = existing ? await querySiteSettingFullRowById(existing.id) : null;
  const themeExisting: ThemeExisting = existingRow
    ? {
        primaryColor: existingRow.primaryColor,
        secondaryColor: existingRow.secondaryColor,
        colorThemePreset: presetAndCustomFromRow(existingRow).colorThemePreset,
      }
    : null;
  const themePatch = mergeThemePatch(data, themeExisting);

  if (!existing) {
    const created = await prisma.siteSetting.create({
      data: {
        siteName: data.siteName ?? DEFAULTS.siteName,
        siteDescription: data.siteDescription ?? null,
        logoUrl: data.logoUrl ?? null,
        primaryColor: themePatch.primaryColor ?? data.primaryColor ?? DEFAULTS.primaryColor,
        secondaryColor: themePatch.secondaryColor ?? data.secondaryColor ?? DEFAULTS.secondaryColor,
        withdrawRejoinDays: data.withdrawRejoinDays ?? DEFAULTS.withdrawRejoinDays,
      },
    });
    if (
      themePatch.colorThemePreset !== undefined ||
      themePatch.colorThemeCustomJson !== undefined
    ) {
      await prisma.$executeRaw`
        UPDATE "SiteSetting" SET
          "colorThemePreset" = ${themePatch.colorThemePreset ?? null},
          "colorThemeCustomJson" = ${themePatch.colorThemeCustomJson ?? null},
          "updatedAt" = ${new Date()}
        WHERE "id" = ${created.id}
      `;
    }
    if (headerPayload || minSolutionLevelForUser !== undefined || introSettingsJson !== undefined) {
      await prisma.$executeRaw`
        UPDATE "SiteSetting"
        SET "headerBgColor" = ${headerBgColor},
            "headerTextColor" = ${headerTextColor},
            "headerActiveColor" = ${headerActiveColor},
            "minSolutionLevelForUser" = ${minSolutionLevelForUser ?? DEFAULTS.minSolutionLevelForUser},
            "introSettingsJson" = COALESCE(${introSettingsJson}, "introSettingsJson"),
            "updatedAt" = ${new Date()}
        WHERE "id" = ${created.id}
      `;
    }
    const row = await querySiteSettingFullRowById(created.id);
    return dbRowToSettings(row!);
  }

  // Header fields are updated via raw SQL below so old Prisma clients (without header columns in runtime) still work
  const updatePayload = {
    ...(data.siteName !== undefined && { siteName: data.siteName }),
    ...(data.siteDescription !== undefined && {
      siteDescription: data.siteDescription,
    }),
    ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
    ...(themePatch.primaryColor !== undefined && { primaryColor: themePatch.primaryColor }),
    ...(themePatch.secondaryColor !== undefined && { secondaryColor: themePatch.secondaryColor }),
    ...(data.withdrawRejoinDays !== undefined && {
      withdrawRejoinDays: Math.max(0, Math.floor(Number(data.withdrawRejoinDays)) || 0),
    }),
    ...(data.homeCarouselFlowSpeed !== undefined && {
      homeCarouselFlowSpeed: clampFlowSpeed(data.homeCarouselFlowSpeed),
    }),
  };
  if (Object.keys(updatePayload).length > 0) {
    await prisma.siteSetting.update({
      where: { id: existing.id },
      data: updatePayload,
    });
  }
  if (
    themePatch.colorThemePreset !== undefined ||
    themePatch.colorThemeCustomJson !== undefined
  ) {
    await prisma.$executeRaw`
      UPDATE "SiteSetting" SET
        "colorThemePreset" = ${themePatch.colorThemePreset ?? null},
        "colorThemeCustomJson" = ${themePatch.colorThemeCustomJson ?? null},
        "updatedAt" = ${new Date()}
      WHERE "id" = ${existing.id}
    `;
  }
  if (headerPayload || minSolutionLevelForUser !== undefined || introSettingsJson !== undefined) {
    await prisma.$executeRaw`
      UPDATE "SiteSetting"
      SET "headerBgColor" = CASE WHEN ${headerPayload !== null} THEN ${headerBgColor} ELSE "headerBgColor" END,
          "headerTextColor" = CASE WHEN ${headerPayload !== null} THEN ${headerTextColor} ELSE "headerTextColor" END,
          "headerActiveColor" = CASE WHEN ${headerPayload !== null} THEN ${headerActiveColor} ELSE "headerActiveColor" END,
          "minSolutionLevelForUser" = COALESCE(${minSolutionLevelForUser}, "minSolutionLevelForUser"),
          "introSettingsJson" = COALESCE(${introSettingsJson}, "introSettingsJson"),
          "updatedAt" = ${new Date()}
      WHERE "id" = ${existing.id}
    `;
    const row = await querySiteSettingFullRowById(existing.id);
    return dbRowToSettings(row!);
  }
  const row = await querySiteSettingFullRowById(existing.id);
  return dbRowToSettings(row!);
}

export type FooterSettingsUpdate = Partial<FooterSettings>;

export async function updateFooterSettings(
  data: FooterSettingsUpdate
): Promise<FooterSettings> {
  const defaults = DEFAULTS.footer;
  if (!isDatabaseConfigured()) {
    return { ...defaults, ...data };
  }
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!existing) {
    await prisma.siteSetting.create({
      data: {
        siteName: DEFAULTS.siteName,
        primaryColor: DEFAULTS.primaryColor,
        secondaryColor: DEFAULTS.secondaryColor,
        footerEnabled: data.footerEnabled ?? defaults.footerEnabled,
        footerBgColor: data.footerBgColor ?? null,
        footerTextColor: data.footerTextColor ?? null,
        footerTitle: data.footerTitle ?? null,
        footerCompanyName: data.footerCompanyName ?? null,
        footerBusinessNumber: data.footerBusinessNumber ?? null,
        footerCeoName: data.footerCeoName ?? null,
        footerAddress: data.footerAddress ?? null,
        footerPhone: data.footerPhone ?? null,
        footerEmail: data.footerEmail ?? null,
        footerCopyright: data.footerCopyright ?? null,
        footerFontSize: data.footerFontSize ?? null,
        footerPartnersJson:
          data.footerPartners != null
            ? footerPartnersToJson(data.footerPartners)
            : null,
      },
    });
    const createdRow = await prisma.siteSetting.findFirst({ orderBy: { updatedAt: "desc" } });
    if (data.footerFontSizes != null || data.footerFontFamilies != null) {
      const sizesJson = data.footerFontSizes != null ? footerFontSizesToJson(data.footerFontSizes) : null;
      const familiesJson = data.footerFontFamilies != null ? footerFontFamiliesToJson(data.footerFontFamilies) : null;
      await prisma.$executeRaw`
        UPDATE "SiteSetting" SET "footerFontSizesJson" = ${sizesJson}, "footerFontFamiliesJson" = ${familiesJson}, "updatedAt" = ${new Date()}
        WHERE "id" = ${createdRow!.id}
      `;
      const row = await querySiteSettingFullRowById(createdRow!.id);
      return dbRowToFooterSettings((row ?? createdRow) as Parameters<typeof dbRowToFooterSettings>[0]);
    }
    return dbRowToFooterSettings(createdRow as Parameters<typeof dbRowToFooterSettings>[0]);
  }

  const footerUpdatePayload = {
    ...(data.footerEnabled !== undefined && { footerEnabled: data.footerEnabled }),
    ...(data.footerBgColor !== undefined && { footerBgColor: data.footerBgColor ?? null }),
    ...(data.footerTextColor !== undefined && { footerTextColor: data.footerTextColor ?? null }),
    ...(data.footerTitle !== undefined && { footerTitle: data.footerTitle ?? null }),
    ...(data.footerCompanyName !== undefined && { footerCompanyName: data.footerCompanyName ?? null }),
    ...(data.footerBusinessNumber !== undefined && { footerBusinessNumber: data.footerBusinessNumber ?? null }),
    ...(data.footerCeoName !== undefined && { footerCeoName: data.footerCeoName ?? null }),
    ...(data.footerAddress !== undefined && { footerAddress: data.footerAddress ?? null }),
    ...(data.footerPhone !== undefined && { footerPhone: data.footerPhone ?? null }),
    ...(data.footerEmail !== undefined && { footerEmail: data.footerEmail ?? null }),
    ...(data.footerCopyright !== undefined && { footerCopyright: data.footerCopyright ?? null }),
    ...(data.footerFontSize !== undefined && { footerFontSize: data.footerFontSize ?? null }),
    ...(data.footerPartners !== undefined && {
      footerPartnersJson: footerPartnersToJson(data.footerPartners),
    }),
  };
  await prisma.siteSetting.update({
    where: { id: existing.id },
    data: footerUpdatePayload,
  });

  const hasFooterJson =
    data.footerFontSizes !== undefined || data.footerFontFamilies !== undefined;
  if (hasFooterJson) {
    const sizesJson =
      data.footerFontSizes !== undefined ? footerFontSizesToJson(data.footerFontSizes ?? {}) : null;
    const familiesJson =
      data.footerFontFamilies !== undefined ? footerFontFamiliesToJson(data.footerFontFamilies ?? {}) : null;
    await prisma.$executeRaw`
      UPDATE "SiteSetting" SET "footerFontSizesJson" = ${sizesJson}, "footerFontFamiliesJson" = ${familiesJson}, "updatedAt" = ${new Date()}
      WHERE "id" = ${existing.id}
    `;
  }

  const row = await querySiteSettingFullRowById(existing.id);
  return dbRowToFooterSettings(row! as Parameters<typeof dbRowToFooterSettings>[0]);
}
