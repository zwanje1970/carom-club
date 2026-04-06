/**
 * STEP 1(홈·커뮤니티 메인·대회 메인) 렌더 구조를 기준으로 한 **페이지 섹션 슬롯** 타입.
 * - 1차: 구조 편집·문서·향후 에디터의 슬롯 식별자로만 사용. 라우트에 아직 연결하지 않음.
 * - CMS `PageSection`(image/text/cta)과 별도: 그것은 `cmsPageSections` 슬롯 안에서 `PageSectionsRenderer`가 처리.
 */
import type { HeroSettings } from "@/lib/hero-settings-defaults";
import type { PageSection, PageSectionSlotType } from "@/types/page-section";
import type { NoticeBar } from "@/types/notice-bar";
import type { Popup } from "@/types/popup";
import type { SiteSettings } from "@/lib/site-settings";
import type { TournamentListRow, VenueCarouselRow } from "@/lib/db-tournaments";
import type { HomePublishedTournamentCard } from "@/lib/home-published-tournament-cards";

/** `getCommonPageData` / 히어로와 맞춘 페이지 키 */
export type SectionLayoutPageKey = "home" | "community" | "tournaments" | "venues";

/** @deprecated 이름 통일: `PageSectionSlotType` 사용 */
export type SectionLayoutSlotKind = PageSectionSlotType;

/** 커뮤니티 허브 `CommunityMainClient`에 넘기는 글 요약 (기존 타입과 동형) */
export type SectionLayoutPostListItem = {
  id: string;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  boardSlug: string;
  boardName: string;
};

/** 난구 목록 `app/community/nangu/page.tsx` 행과 동형 */
export type SectionLayoutNanguListItem = {
  id: string;
  title: string;
  authorName: string;
  createdAt: Date | string;
  solutionCount: number;
};

// --- Props 계약 (각 슬롯이 기대하는 데이터; 컴포넌트에 그대로 전달 가능한 형태) ---

export type HeroSlotProps = {
  heroSettings: HeroSettings;
};

export type NoticeOverlaySlotProps = {
  noticeBars: NoticeBar[];
  popups: Popup[];
};

export type CmsPageSectionsSlotProps = {
  sections: PageSection[];
};

export type QuickMenuSlotProps = {
  /** `HomeNoticeCommunity`가 쓰는 copy + 진입 노출 플래그 */
  copy: Record<string, string>;
  showNoteEntry: boolean;
  showSolverEntry: boolean;
};

export type HomeCarouselsSlotProps = {
  initialTournaments: HomePublishedTournamentCard[];
  carouselVenues: VenueCarouselRow[];
  copy: Record<string, string>;
  homeCarouselFlowSpeed: SiteSettings["homeCarouselFlowSpeed"];
};

export type PostListSlotProps = {
  latest: SectionLayoutPostListItem[];
  initialCategory: "all" | "free" | "qna" | "notice";
  canManageReports: boolean;
  showSolverEntry: boolean;
};

export type NanguListSlotProps = {
  posts: SectionLayoutNanguListItem[];
  canCreatePost: boolean;
};

export type TournamentListSlotProps = {
  copy: Record<string, string>;
  initialList: TournamentListRow[];
  initialHasMore: boolean;
  initialQuery: {
    tab: string;
    sortBy: string;
    national: boolean;
  };
};

/** 슬롯별 메타(역할·컴포넌트·허용 페이지) — 런타임 참조용 */
export const SECTION_LAYOUT_SLOT_REGISTRY: Record<
  SectionLayoutSlotKind,
  {
    roleKo: string;
    components: string[];
    allowedPages: SectionLayoutPageKey[];
  }
> = {
  hero: {
    roleKo: "메인 비주얼·제목·버튼 (사이트 설정 heroSettingsJson)",
    components: ["HomeHero"],
    allowedPages: ["home"],
  },
  noticeOverlay: {
    roleKo: "상단 공지 스트립 + (선택) 팝업",
    components: ["ContentLayer", "NoticeBar", "Popup"],
    allowedPages: ["home", "community", "tournaments", "venues"],
  },
  cmsPageSections: {
    roleKo: "관리자 구성 블록 연속 (이미지 / 텍스트 / CTA)",
    components: ["PageSectionsRenderer", "ImageSection", "TextSection", "CtaSection"],
    allowedPages: ["home", "community", "tournaments", "venues"],
  },
  quickMenu: {
    roleKo: "큰 탭형 진입 카드(난구해결사·노트 등)",
    components: ["HomeNoticeCommunity"],
    allowedPages: ["home"],
  },
  homeCarousels: {
    roleKo: "홈 전용: 대회·당구장 캐러셀(레거시 슬롯 — 실제 UI는 tournamentIntro·venueIntro 슬롯)",
    components: [
      "HomeTournamentCards",
      "HomeTournamentListAutoScroll",
      "HomeTournamentCarouselRows",
      "HomeTournamentCardItem",
      "VenueCarousel",
    ],
    allowedPages: ["home"],
  },
  tournamentIntro: {
    roleKo: "홈: 진행 대회 안내(캐러셀·내 주변 찾기)",
    components: ["HomeTournamentIntroSlot", "HomeTournamentCards"],
    allowedPages: ["home"],
  },
  venueIntro: {
    roleKo: "홈: 당구장 소개 가로 캐러셀",
    components: ["HomeVenueIntroSlot", "VenueCarousel"],
    allowedPages: ["home"],
  },
  venueLink: {
    roleKo: "홈: 당구장 전체 보기 링크",
    components: ["PageContentContainer", "SlotBlockCtaLink(block CTA)"],
    allowedPages: ["home"],
  },
  nanguEntry: {
    roleKo: "홈: 난구노트·난구해결사 진입 카드",
    components: ["HomeNoticeCommunity"],
    allowedPages: ["home"],
  },
  postList: {
    roleKo: "커뮤니티 허브 통합 글 목록(카테고리 탭·난구 진입 카드 포함)",
    components: ["CommunityMainClient", "CommunityWriteFab"],
    allowedPages: ["community"],
  },
  nanguList: {
    roleKo: "난구해결사 게시판 목록(글쓰기 버튼·행 링크)",
    components: ["app/community/nangu/page.tsx 인라인 목록", "NanguSolverIcon"],
    allowedPages: ["community"],
  },
  tournamentList: {
    roleKo: "대회 공개 목록 + 필터/탭",
    components: ["PageContentContainer", "TournamentsListWithFilters"],
    allowedPages: ["tournaments"],
  },
};
