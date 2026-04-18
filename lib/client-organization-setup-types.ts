/**
 * v2 client/setup organization · typeSpecificJson 구조 (이식용)
 */

export const ORG_TYPES = [
  { value: "VENUE", label: "당구장" },
  { value: "CLUB", label: "동호회" },
  { value: "FEDERATION", label: "연맹" },
  { value: "INSTRUCTOR", label: "레슨" },
] as const;

export type OrgType = (typeof ORG_TYPES)[number]["value"];

export type VenueTableInfo = { kind?: string; count?: string; fee?: string };
export type VenueCategoryOption = "daedae_only" | "mixed";

/** 당구장 요금 유형 (저장·목록·필터 연동) */
export type VenuePricingType = "GENERAL" | "FLAT" | "MIXED";

export type VenueSpecific = {
  venueCategory?: VenueCategoryOption;
  representativeImageUrls?: string[];
  daedae?: VenueTableInfo;
  jungdae?: VenueTableInfo;
  pocket?: VenueTableInfo;
  businessHours?: string;
  /** 일반요금 / 정액제 (당구장 안내 필터·구버전 호환) */
  feeCategory?: "normal" | "flat";
  /** 요금 유형 (없으면 parse 시 feeCategory로 유추) */
  pricingType?: VenuePricingType;
  /** 정액제 안내 자유 입력(여러 줄) */
  flatRateInfo?: string;
  /** 운영 점수판 (단일 또는 쉼표 구분) */
  scoreSystem?: string;
};

export type ClubSpecific = {
  memberCount?: string;
  membershipFee?: string;
  activityRegion?: string;
};

export type FederationSpecific = { introduction?: string };

export type CurriculumItem = { title: string; cost: string };

export type InstructorSpecific = {
  instructorIntro?: string;
  lessonLocation?: string;
  curriculum?: CurriculumItem[];
};

export type TypeSpecific = VenueSpecific | ClubSpecific | FederationSpecific | InstructorSpecific;

/** v2 Org 엔티티와 동일 필드 */
export type ClientOrganizationSetup = {
  id: string;
  slug: string;
  name: string;
  type: string;
  shortDescription: string | null;
  description: string | null;
  fullDescription: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  addressDetail: string | null;
  addressNaverMapEnabled: boolean | null;
  region: string | null;
  typeSpecificJson: string | null;
  isPublished: boolean;
  setupCompleted: boolean;
};

export function emptyTypeSpecificForType(type: OrgType): TypeSpecific {
  if (type === "INSTRUCTOR") return { curriculum: [] };
  return {};
}
