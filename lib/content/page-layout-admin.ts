import type { PageSection, PageSectionSlotType, PageSlug, SectionType } from "@/types/page-section";

/**
 * 페이지 빌더: 홈/허브의 슬롯·CMS 행 **구조**와 sortOrder.
 * 카드/CTA 옵션은 빌더 `SectionRowTools`; 행 본문 데이터는 콘텐츠 편집; 히어로·전역 설정은 사이트 관리.
 */
export type PageLayoutAddTemplate =
  | { kind: "cms"; sectionType: SectionType }
  | { kind: "slot"; slotType: PageSectionSlotType };

/** 페이지 빌더·관리 UI용 슬롯 표시 이름 */
export const PAGE_SECTION_SLOT_LABELS: Record<PageSectionSlotType, string> = {
  hero: "히어로",
  noticeOverlay: "공지·팝업 오버레이",
  cmsPageSections: "CMS 섹션 묶음",
  quickMenu: "퀵 메뉴",
  homeCarousels: "홈 캐러셀",
  tournamentIntro: "대회 안내",
  venueIntro: "당구장 소개",
  venueLink: "당구장 목록 링크",
  nanguEntry: "난구노트·난구해결사",
  postList: "게시글 목록",
  nanguList: "난구 목록",
  tournamentList: "대회 목록",
};

/** 빌더에서 추가 시 `POST /api/admin/content/page-sections` 바디로 사용 */
export function buildPageLayoutSectionPayload(
  page: PageSlug,
  template: PageLayoutAddTemplate,
  nextSortOrder: number,
  id: string
): Omit<PageSection, "createdAt" | "updatedAt"> {
  const base = {
    id,
    page,
    placement: "content_middle" as const,
    sortOrder: nextSortOrder,
    title: "",
    subtitle: null as string | null,
    description: null as string | null,
    textAlign: "center" as const,
    imageUrl: null as string | null,
    imageUrlMobile: null as string | null,
    imageHeightPc: 400,
    imageHeightMobile: 280,
    linkType: "none" as const,
    internalPage: null,
    internalPath: null,
    externalUrl: null,
    openInNewTab: false,
    buttons: [] as PageSection["buttons"],
    isVisible: true,
    startAt: null,
    endAt: null,
    backgroundColor: null,
    titleIconType: "none" as const,
    titleIconName: null,
    titleIconImageUrl: null,
    titleIconSize: null,
    sectionStyleJson: null,
    slotConfigJson: null,
    deletedAt: null,
  };

  if (template.kind === "cms") {
    const type = template.sectionType;
    const title =
      type === "text" ? "새 텍스트 섹션" : type === "image" ? "새 이미지 섹션" : "새 CTA 섹션";
    return {
      ...base,
      type,
      title,
      slotType: null,
    };
  }

  const st = template.slotType;
  return {
    ...base,
    type: "text",
    title: `구조: ${PAGE_SECTION_SLOT_LABELS[st] ?? st}`,
    slotType: st,
  };
}
