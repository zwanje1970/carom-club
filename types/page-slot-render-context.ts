import type { AdminCopyKey } from "@/lib/admin-copy";
import type { PublicTournamentListRow, VenueCarouselRow } from "@/lib/db-tournaments";
import type { HomePublishedTournamentCard } from "@/lib/home-published-tournament-cards";
import type { HeroSettings } from "@/lib/hero-settings-defaults";
import type { SiteSettings } from "@/lib/site-settings";

/** `CommunityMainClient` / 커뮤니티 허브 목록과 동형 */
export type CommunityHubPostItem = {
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

export type PageSlotRenderContextPage = "home" | "community" | "tournaments";

/**
 * `PageRenderer`가 `slotType` 행을 그릴 때 필요한 데이터.
 * 공개 페이지는 서버에서 채우고, 관리자 미리보기는 API로 동형 채움.
 * 홈 구조 슬롯(`tournamentIntro` 등): `buildHomeSlotRenderPayload` 결과.
 */
export type HomeSlotRenderContextPayload = {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
  initialTournaments: HomePublishedTournamentCard[];
  carouselVenues: VenueCarouselRow[];
  showNoteEntry: boolean;
  showSolverEntry: boolean;
};

export type PageSlotRenderContext = {
  page: PageSlotRenderContextPage;
  heroSettings?: HeroSettings | null;
  home?: HomeSlotRenderContextPayload | null;
  community?: {
    latest: CommunityHubPostItem[];
    initialCategory: "all" | "free" | "qna" | "notice";
    canManageReports?: boolean;
    showSolverEntry: boolean;
    /** 관리자 문구(커뮤니티 진입 카드 등). 없으면 `getCopyValue` 기본값 */
    copy?: Record<string, string>;
  };
  tournaments?: {
    copy: Record<AdminCopyKey, string>;
    initialList: PublicTournamentListRow[];
    initialHasMore: boolean;
    initialQuery: {
      tab: "upcoming" | "closed" | "finished";
      sortBy: "distance" | "deadline" | "date";
      national: boolean;
    };
  };
};
