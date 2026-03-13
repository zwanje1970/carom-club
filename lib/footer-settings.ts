/** 협력업체 카테고리 */
export type FooterPartnerCategory = "CARD" | "AD" | "SPONSOR" | "PARTNER";

export type FooterPartner = {
  id: string;
  name: string;
  category: FooterPartnerCategory;
  logoUrl: string | null;
  websiteUrl: string | null;
  sortOrder: number;
  enabled: boolean;
};

/** 푸터 내용 글꼴 크기 (xs=12px, sm=14px, base=16px, lg=18px) */
export type FooterFontSize = "xs" | "sm" | "base" | "lg";

export const FOOTER_FONT_SIZE_OPTIONS: { value: FooterFontSize; label: string }[] = [
  { value: "xs", label: "작게 (12px)" },
  { value: "sm", label: "보통 작게 (14px)" },
  { value: "base", label: "보통 (16px)" },
  { value: "lg", label: "크게 (18px)" },
];

/** 푸터에서 선택 가능한 글꼴 (layout에서 로드된 웹폰트 기준) */
export const FOOTER_FONT_FAMILY_OPTIONS: { value: string; label: string; fontFamily: string }[] = [
  { value: "", label: "기본", fontFamily: "inherit" },
  { value: "Pretendard", label: "Pretendard", fontFamily: "Pretendard, sans-serif" },
  { value: "Spoqa Han Sans Neo", label: "Spoqa Han Sans Neo", fontFamily: '"Spoqa Han Sans Neo", sans-serif' },
  { value: "Noto Sans KR", label: "Noto Sans KR", fontFamily: '"Noto Sans KR", sans-serif' },
  { value: "Nanum Gothic", label: "나눔고딕", fontFamily: '"Nanum Gothic", sans-serif' },
  { value: "Nanum Myeongjo", label: "나눔명조", fontFamily: '"Nanum Myeongjo", serif' },
  { value: "Black Han Sans", label: "Black Han Sans", fontFamily: '"Black Han Sans", sans-serif' },
  { value: "Do Hyeon", label: "Do Hyeon", fontFamily: '"Do Hyeon", sans-serif' },
  { value: "Gothic A1", label: "Gothic A1", fontFamily: '"Gothic A1", sans-serif' },
  { value: "IBM Plex Sans KR", label: "IBM Plex Sans KR", fontFamily: '"IBM Plex Sans KR", sans-serif' },
  { value: "system-ui", label: "system-ui", fontFamily: "system-ui, sans-serif" },
];

/** 저장된 글꼴 value → CSS font-family */
export function getFooterFontFamilyCss(value: string | null | undefined): string {
  if (!value) return "inherit";
  const opt = FOOTER_FONT_FAMILY_OPTIONS.find((o) => o.value === value);
  return opt ? opt.fontFamily : "inherit";
}

/** 주관사 정보 항목별 글자크기 키 */
export const FOOTER_ITEM_FONT_SIZE_KEYS = [
  "title",
  "companyName",
  "businessNumber",
  "ceoName",
  "address",
  "phone",
  "email",
  "copyright",
] as const;
export type FooterItemFontSizeKey = (typeof FOOTER_ITEM_FONT_SIZE_KEYS)[number];

export const FOOTER_ITEM_FONT_SIZE_LABELS: Record<FooterItemFontSizeKey, string> = {
  title: "푸터 제목",
  companyName: "회사/단체명",
  businessNumber: "사업자등록번호",
  ceoName: "대표자명",
  address: "주소",
  phone: "연락처",
  email: "이메일",
  copyright: "하단 문구 (저작권)",
};

/** 항목 키 → FooterSettings 필드명 */
export const FOOTER_ITEM_KEY_TO_FIELD: Record<FooterItemFontSizeKey, keyof FooterSettings> = {
  title: "footerTitle",
  companyName: "footerCompanyName",
  businessNumber: "footerBusinessNumber",
  ceoName: "footerCeoName",
  address: "footerAddress",
  phone: "footerPhone",
  email: "footerEmail",
  copyright: "footerCopyright",
};

export type FooterItemFontSizes = Partial<Record<FooterItemFontSizeKey, FooterFontSize | null>>;

/** 항목별 글꼴(폰트 패밀리) - value는 FOOTER_FONT_FAMILY_OPTIONS의 value */
export type FooterItemFontFamilies = Partial<Record<FooterItemFontSizeKey, string | null>>;

export type FooterSettings = {
  footerEnabled: boolean;
  footerBgColor: string | null;
  footerTextColor: string | null;
  footerFontSize: FooterFontSize | null;
  footerFontSizes: FooterItemFontSizes;
  footerFontFamilies: FooterItemFontFamilies;
  footerTitle: string | null;
  footerCompanyName: string | null;
  footerBusinessNumber: string | null;
  footerCeoName: string | null;
  footerAddress: string | null;
  footerPhone: string | null;
  footerEmail: string | null;
  footerCopyright: string | null;
  footerPartners: FooterPartner[];
};

const DEFAULT_FOOTER: FooterSettings = {
  footerEnabled: false,
  footerBgColor: null,
  footerTextColor: null,
  footerFontSize: null,
  footerFontSizes: {},
  footerFontFamilies: {},
  footerTitle: null,
  footerCompanyName: null,
  footerBusinessNumber: null,
  footerCeoName: null,
  footerAddress: null,
  footerPhone: null,
  footerEmail: null,
  footerCopyright: null,
  footerPartners: [],
};

export const FOOTER_PARTNER_CATEGORIES: { value: FooterPartnerCategory; label: string }[] = [
  { value: "CARD", label: "카드사" },
  { value: "AD", label: "광고업체" },
  { value: "SPONSOR", label: "후원업체" },
  { value: "PARTNER", label: "협력업체" },
];

function parsePartnersJson(json: string | null): FooterPartner[] {
  if (!json?.trim()) return [];
  try {
    const raw = JSON.parse(json) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (item): item is Record<string, unknown> =>
          item != null && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
      )
      .map((item) => ({
        id: String(item.id),
        name: String(item.name ?? ""),
        category: ["CARD", "AD", "SPONSOR", "PARTNER"].includes(String(item.category))
          ? (item.category as FooterPartnerCategory)
          : "PARTNER",
        logoUrl: item.logoUrl != null ? String(item.logoUrl) : null,
        websiteUrl: item.websiteUrl != null ? String(item.websiteUrl) : null,
        sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : 0,
        enabled: item.enabled !== false,
      }));
  } catch {
    return [];
  }
}

export function footerPartnersToJson(partners: FooterPartner[]): string {
  return JSON.stringify(
    partners.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      logoUrl: p.logoUrl,
      websiteUrl: p.websiteUrl,
      sortOrder: p.sortOrder,
      enabled: p.enabled,
    }))
  );
}

type FooterRow = {
  footerEnabled: boolean | null;
  footerBgColor: string | null;
  footerTextColor: string | null;
  footerFontSize: string | null;
  footerFontSizesJson: string | null;
  footerFontFamiliesJson: string | null;
  footerTitle: string | null;
  footerCompanyName: string | null;
  footerBusinessNumber: string | null;
  footerCeoName: string | null;
  footerAddress: string | null;
  footerPhone: string | null;
  footerEmail: string | null;
  footerCopyright: string | null;
  footerPartnersJson: string | null;
};

const VALID_FOOTER_FONT_SIZES: FooterFontSize[] = ["xs", "sm", "base", "lg"];

function parseFooterFontSizesJson(json: string | null): FooterItemFontSizes {
  if (!json?.trim()) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: FooterItemFontSizes = {};
    for (const key of FOOTER_ITEM_FONT_SIZE_KEYS) {
      const v = raw[key];
      if (v != null && VALID_FOOTER_FONT_SIZES.includes(v as FooterFontSize)) {
        out[key] = v as FooterFontSize;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function footerFontSizesToJson(sizes: FooterItemFontSizes): string {
  const obj: Record<string, string | null> = {};
  for (const key of FOOTER_ITEM_FONT_SIZE_KEYS) {
    if (sizes[key] !== undefined) obj[key] = sizes[key] ?? null;
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : "";
}

function parseFooterFontFamiliesJson(json: string | null): FooterItemFontFamilies {
  if (!json?.trim()) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: FooterItemFontFamilies = {};
    for (const key of FOOTER_ITEM_FONT_SIZE_KEYS) {
      const v = raw[key];
      if (v != null && typeof v === "string") out[key] = v || null;
    }
    return out;
  } catch {
    return {};
  }
}

export function footerFontFamiliesToJson(families: FooterItemFontFamilies): string {
  const obj: Record<string, string | null> = {};
  for (const key of FOOTER_ITEM_FONT_SIZE_KEYS) {
    if (families[key] !== undefined) obj[key] = families[key] ?? null;
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : "";
}

export function dbRowToFooterSettings(row: FooterRow | null): FooterSettings {
  if (!row) return { ...DEFAULT_FOOTER };
  const footerFontSize =
    row.footerFontSize && VALID_FOOTER_FONT_SIZES.includes(row.footerFontSize as FooterFontSize)
      ? (row.footerFontSize as FooterFontSize)
      : null;
  return {
    footerEnabled: row.footerEnabled ?? false,
    footerBgColor: row.footerBgColor ?? null,
    footerTextColor: row.footerTextColor ?? null,
    footerFontSize,
    footerFontSizes: parseFooterFontSizesJson(row.footerFontSizesJson),
    footerFontFamilies: parseFooterFontFamiliesJson(row.footerFontFamiliesJson),
    footerTitle: row.footerTitle ?? null,
    footerCompanyName: row.footerCompanyName ?? null,
    footerBusinessNumber: row.footerBusinessNumber ?? null,
    footerCeoName: row.footerCeoName ?? null,
    footerAddress: row.footerAddress ?? null,
    footerPhone: row.footerPhone ?? null,
    footerEmail: row.footerEmail ?? null,
    footerCopyright: row.footerCopyright ?? null,
    footerPartners: parsePartnersJson(row.footerPartnersJson),
  };
}

export { DEFAULT_FOOTER };
