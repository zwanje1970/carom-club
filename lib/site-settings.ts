import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  type FooterSettings,
  dbRowToFooterSettings,
  footerPartnersToJson,
} from "@/lib/footer-settings";

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
  withdrawRejoinDays: number;
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
  footer: FooterSettings;
};

const DEFAULTS: SiteSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
  primaryColor: DEFAULT_PRIMARY_COLOR,
  secondaryColor: DEFAULT_SECONDARY_COLOR,
  withdrawRejoinDays: 0,
  headerBgColor: null,
  headerTextColor: null,
  headerActiveColor: null,
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
    footerPartners: [],
  },
};

export async function getSiteSettings(): Promise<SiteSettings> {
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
    return dbRowToSettings(row);
  } catch {
    return DEFAULTS;
  }
}

type SiteSettingRow = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  withdrawRejoinDays?: number;
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
  footerPartnersJson?: string | null;
};

function dbRowToSettings(row: SiteSettingRow): SiteSettings {
  const footer = dbRowToFooterSettings(row as Parameters<typeof dbRowToFooterSettings>[0]);
  return {
    siteName: row.siteName,
    siteDescription: row.siteDescription,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    withdrawRejoinDays: row.withdrawRejoinDays ?? 0,
    headerBgColor: row.headerBgColor ?? null,
    headerTextColor: row.headerTextColor ?? null,
    headerActiveColor: row.headerActiveColor ?? null,
    footer,
  };
}

export async function updateSiteSettings(
  data: Partial<Omit<SiteSettings, "footer">>
): Promise<SiteSettings> {
  if (!isDatabaseConfigured()) {
    return { ...DEFAULTS, ...data };
  }
  const existing = await prisma.siteSetting.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!existing) {
    const created = await prisma.siteSetting.create({
      data: {
        siteName: data.siteName ?? DEFAULTS.siteName,
        siteDescription: data.siteDescription ?? null,
        logoUrl: data.logoUrl ?? null,
        primaryColor: data.primaryColor ?? DEFAULTS.primaryColor,
        secondaryColor: data.secondaryColor ?? DEFAULTS.secondaryColor,
        withdrawRejoinDays: data.withdrawRejoinDays ?? DEFAULTS.withdrawRejoinDays,
      },
    });
    return dbRowToSettings(created);
  }
  const updated = await prisma.siteSetting.update({
    where: { id: existing.id },
    data: {
      ...(data.siteName !== undefined && { siteName: data.siteName }),
      ...(data.siteDescription !== undefined && {
        siteDescription: data.siteDescription,
      }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.primaryColor !== undefined && {
        primaryColor: data.primaryColor,
      }),
      ...(data.secondaryColor !== undefined && {
        secondaryColor: data.secondaryColor,
      }),
      ...(data.withdrawRejoinDays !== undefined && {
        withdrawRejoinDays: Math.max(0, Math.floor(Number(data.withdrawRejoinDays)) || 0),
      }),
      ...(data.headerBgColor !== undefined && { headerBgColor: data.headerBgColor ?? null }),
      ...(data.headerTextColor !== undefined && { headerTextColor: data.headerTextColor ?? null }),
      ...(data.headerActiveColor !== undefined && { headerActiveColor: data.headerActiveColor ?? null }),
    },
  });
  return dbRowToSettings(updated);
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
        footerPartnersJson:
          data.footerPartners != null
            ? footerPartnersToJson(data.footerPartners)
            : null,
      },
    });
    const row = await prisma.siteSetting.findFirst({ orderBy: { updatedAt: "desc" } });
    return dbRowToFooterSettings(row);
  }
  const updated = await prisma.siteSetting.update({
    where: { id: existing.id },
    data: {
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
      ...(data.footerPartners !== undefined && {
        footerPartnersJson: footerPartnersToJson(data.footerPartners),
      }),
    },
  });
  return dbRowToFooterSettings(updated);
}
