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

export type FooterSettings = {
  footerEnabled: boolean;
  footerBgColor: string | null;
  footerTextColor: string | null;
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

export function dbRowToFooterSettings(row: FooterRow | null): FooterSettings {
  if (!row) return { ...DEFAULT_FOOTER };
  return {
    footerEnabled: row.footerEnabled ?? false,
    footerBgColor: row.footerBgColor ?? null,
    footerTextColor: row.footerTextColor ?? null,
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
