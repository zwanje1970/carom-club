import type { PageSectionSlotType, PageSlug, SectionType } from "@/types/page-section";

/** 페이지 빌더에서 다루는 페이지 키(홈·커뮤니티·대회) */
export const PAGE_BUILDER_KEYS = ["home", "community", "tournaments"] as const;
export type PageBuilderKey = (typeof PAGE_BUILDER_KEYS)[number];

/**
 * 슬롯·CMS 유형별 허용 `page` 키.
 * - CMS(`slotType` 없음): 빌더 대상 페이지 전부.
 * - 홈 전용 슬롯: hero, homeCarousels, quickMenu, tournamentIntro, venueIntro, venueLink, nanguEntry
 * - 커뮤니티: postList, nanguList
 * - 대회: tournamentList
 * - 공통 슬롯: noticeOverlay, cmsPageSections
 */
export function getAllowedPagesForSection(
  slotType: PageSectionSlotType | null | undefined,
  _sectionType: SectionType
): PageSlug[] {
  if (slotType == null || slotType === undefined) {
    return [...PAGE_BUILDER_KEYS];
  }
  switch (slotType) {
    case "hero":
    case "homeCarousels":
    case "quickMenu":
    case "tournamentIntro":
    case "venueIntro":
    case "venueLink":
    case "nanguEntry":
      return ["home"];
    case "postList":
    case "nanguList":
      return ["community"];
    case "tournamentList":
      return ["tournaments"];
    case "noticeOverlay":
    case "cmsPageSections":
      return [...PAGE_BUILDER_KEYS];
  }
}

export function isSectionAllowedOnPage(
  page: PageSlug,
  slotType: PageSectionSlotType | null | undefined,
  sectionType: SectionType
): boolean {
  return getAllowedPagesForSection(slotType, sectionType).includes(page);
}

export function pageNotAllowedMessage(): string {
  return "이 슬롯·CMS 유형은 해당 페이지에 배치할 수 없습니다. 홈 전용 슬롯은 홈, 게시글·난구 슬롯은 커뮤니티, 대회 목록 슬롯은 대회 페이지로만 옮기거나 복제할 수 있습니다.";
}

/** 빌더 UI용: 허용 페이지만, 라벨은 호출 측에서 붙임 */
export function getAllowedBuilderPageOptions(
  slotType: PageSectionSlotType | null | undefined,
  sectionType: SectionType
): PageBuilderKey[] {
  const allowed = getAllowedPagesForSection(slotType, sectionType);
  return PAGE_BUILDER_KEYS.filter((p) => allowed.includes(p));
}
