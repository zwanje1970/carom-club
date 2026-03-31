/**
 * 페이지 섹션 콘텐츠 타입 (CMS)
 * Neon DB 연결 시 테이블 구조 설계에 사용
 */

export type SectionType = "image" | "text" | "cta";

/**
 * `PageSection.slotType` — 페이지 **구조 슬롯** (렌더 분기).
 * `null`/미설정: 레거시 CMS 행 — `type`(image|text|cta) + `PageSectionsRenderer`.
 */
export type PageSectionSlotType =
  | "hero"
  | "noticeOverlay"
  | "cmsPageSections"
  | "quickMenu"
  | "homeCarousels"
  | "tournamentIntro"
  | "venueIntro"
  | "venueLink"
  | "nanguEntry"
  | "postList"
  | "nanguList"
  | "tournamentList";

export type PageSlug = "home" | "venues" | "tournaments" | "community" | "mypage";

export type PlacementSlug =
  | "below_header"
  | "main_visual_bg"
  | "below_main_copy"
  | "above_content"
  | "content_middle"
  | "content_bottom";

export type TextAlign = "left" | "center" | "right";

export type LinkType = "none" | "internal" | "external";

export type InternalPageSlug =
  | "home"
  | "venues"
  | "tournaments"
  | "community"
  | "mypage"
  | "login"
  | "signup";

export type HeroButtonSize = "sm" | "md" | "lg";

export interface SectionButton {
  id: string;
  name: string;
  linkType: "internal" | "external";
  href: string;
  openInNewTab: boolean;
  isPrimary: boolean;
  /** 히어로 버튼 크기 (sm/md/lg) */
  size?: HeroButtonSize;
}

export interface PageSection {
  id: string;
  type: SectionType;
  title: string;
  subtitle: string | null;
  description: string | null;
  textAlign: TextAlign;
  page: PageSlug;
  placement: PlacementSlug;
  /** 이미지 섹션 */
  imageUrl: string | null;
  imageUrlMobile: string | null;
  imageHeightPc: number | null;
  imageHeightMobile: number | null;
  /** 링크 설정 (섹션 전체) */
  linkType: LinkType;
  internalPage: InternalPageSlug | null;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  /** 버튼 (텍스트/CTA 섹션, 최대 3개) */
  buttons: SectionButton[];
  /** 표시 설정 (요구사항의 enabled) */
  isVisible: boolean;
  /** 요구사항의 displayOrder — 동일 `page` 내 오름차순 정렬 */
  sortOrder: number;
  /**
   * 구조 슬롯 종류. null/undefined면 CMS 블록(`type`으로 분기).
   * 값이 있으면 `slotType`으로 렌더 분기(데이터 소스는 기존 SiteSetting·별도 API 등과 조합).
   */
  slotType?: PageSectionSlotType | null;
  /** 슬롯별 소량 JSON(키·플래그). 자유 HTML·장문 콘텐츠 금지(1차 구조 편집용). */
  slotConfigJson?: string | null;
  startAt: string | null; // ISO date
  endAt: string | null;   // ISO date
  /** 섹션 배경색 (hex 등). 없으면 기존 스타일 유지 */
  backgroundColor?: string | null;
  /** JSON: 애니메이션·구분선 등 (section-style.ts) */
  sectionStyleJson?: string | null;
  /** 제목 왼쪽 아이콘: none | icon | image */
  titleIconType?: "none" | "icon" | "image" | null;
  titleIconName?: string | null;
  titleIconImageUrl?: string | null;
  /** small: 16~18px, medium: 20~24px */
  titleIconSize?: "small" | "medium" | null;
  createdAt: string;
  updatedAt: string;
  /** 소프트 삭제 시각 — 있으면 공개에 노출되지 않음 */
  deletedAt?: string | null;
}
