import {
  ORG_TYPES,
  type InstructorSpecific,
  type OrgType,
  type TypeSpecific,
  type VenuePricingType,
  type VenueSpecific,
  emptyTypeSpecificForType,
} from "./client-organization-setup-types";

/** 저장 데이터·구버전 feeCategory 기준으로 요금 유형 확정 */
export function resolveVenuePricingType(vs: VenueSpecific): VenuePricingType {
  const pt = vs.pricingType;
  if (pt === "GENERAL" || pt === "FLAT" || pt === "MIXED") return pt;
  if (vs.feeCategory === "flat") return "FLAT";
  return "GENERAL";
}

export function isOrgType(v: string): v is OrgType {
  return ORG_TYPES.some((t) => t.value === v);
}

/** v2 parseTypeSpecific와 동일 */
export function parseTypeSpecific(type: OrgType, json: string | null): TypeSpecific {
  if (!json?.trim()) {
    if (type === "INSTRUCTOR") return { curriculum: [] };
    return emptyTypeSpecificForType(type);
  }
  try {
    const parsed = JSON.parse(json) as TypeSpecific & {
      daedaeFee?: string;
      jungdaeFee?: string;
      pocketFee?: string;
    };
    if (type === "INSTRUCTOR" && !Array.isArray((parsed as InstructorSpecific).curriculum)) {
      (parsed as InstructorSpecific).curriculum = [];
    }
    if (type === "VENUE") {
      const v = parsed as VenueSpecific;
      v.representativeImageUrls = normalizeRepresentativeImageUrls((v as VenueSpecific).representativeImageUrls);
      if (v && (v as { daedaeFee?: string }).daedaeFee && !v.daedae) v.daedae = { fee: (v as { daedaeFee?: string }).daedaeFee };
      if (v && (v as { jungdaeFee?: string }).jungdaeFee && !v.jungdae) v.jungdae = { fee: (v as { jungdaeFee?: string }).jungdaeFee };
      if (v && (v as { pocketFee?: string }).pocketFee && !v.pocket) v.pocket = { fee: (v as { pocketFee?: string }).pocketFee };
      if (v.pricingType !== "GENERAL" && v.pricingType !== "FLAT" && v.pricingType !== "MIXED") {
        v.pricingType = resolveVenuePricingType(v);
      }
    }
    return parsed as TypeSpecific;
  } catch {
    return type === "INSTRUCTOR" ? { curriculum: [] } : emptyTypeSpecificForType(type);
  }
}

export const MAX_REPRESENTATIVE_IMAGES = 4;

export function normalizeRepresentativeImageUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);
  const unique: string[] = [];
  for (const url of cleaned) {
    if (unique.includes(url)) continue;
    unique.push(url);
    if (unique.length >= MAX_REPRESENTATIVE_IMAGES) break;
  }
  return unique;
}
