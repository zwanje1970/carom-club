import type { SiteCommunityBoardKey, SiteCommunityConfig } from "../../../lib/types/entities";

/** 탭·모바일 스와이프에 쓰는 물리 게시판 키(설정 `order`로 정렬) */
export const COMMUNITY_SWIPE_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1", "extra2"];

export function visibleCommunityBoardKeysForTabs(config: SiteCommunityConfig): SiteCommunityBoardKey[] {
  return COMMUNITY_SWIPE_BOARD_KEYS.filter((k) => config[k].visible).sort(
    (a, b) => config[a].order - config[b].order,
  );
}

/** 목록 URL — `[boardType]` 라우트·파서와 동일 규칙 */
export function communityBoardListHref(boardKey: SiteCommunityBoardKey): string {
  if (boardKey === "reviews") return "/site/community/review";
  if (boardKey === "extra1") return "/site/community/jobs";
  return `/site/community/${boardKey}`;
}

/** 게시글 상세·수정 등 `[boardType]/[id]` 경로 — 내부 키(reviews) → URL 세그먼트(review) */
export function communityPostDetailHref(boardKey: SiteCommunityBoardKey, postId: string): string {
  return `${communityBoardListHref(boardKey)}/${postId}`;
}

/** 상단 탭 라벨 (자유게시판 … 구인구직) */
export const COMMUNITY_PRIMARY_TAB_LABEL = {
  free: "자유게시판",
  qna: "질문게시판",
  reviews: "대회후기",
  extra1: "구인구직",
} as const;

/** 전체 탭 목록에서만 제목 앞 [방이름] — 짧은 표기 */
export const COMMUNITY_ROOM_PREFIX_SHORT: Record<
  keyof typeof COMMUNITY_PRIMARY_TAB_LABEL,
  string
> = {
  free: "자유",
  qna: "질문",
  reviews: "대회후기",
  extra1: "구인구직",
};

export type CommunityHubTabKey = "all" | SiteCommunityBoardKey;

export type CommunityNavTabItem = { key: CommunityHubTabKey; label: string; href: string };

export function isPrimaryTabKey(k: SiteCommunityBoardKey): k is keyof typeof COMMUNITY_PRIMARY_TAB_LABEL {
  return k in COMMUNITY_PRIMARY_TAB_LABEL;
}

export function communityTabLabelForBoard(boardKey: SiteCommunityBoardKey, config: SiteCommunityConfig): string {
  if (isPrimaryTabKey(boardKey)) return COMMUNITY_PRIMARY_TAB_LABEL[boardKey];
  const label = config[boardKey].label.trim();
  return label.length > 0 ? label : boardKey;
}

/** 전체 탭 + 플랫폼에서 `visible` 인 게시판만 (비활성 예비·구인구직 등은 노출 안 함) */
export function communityNavTabsFromConfig(config: SiteCommunityConfig): CommunityNavTabItem[] {
  const boards = visibleCommunityBoardKeysForTabs(config);
  return [
    { key: "all", label: "전체", href: "/site/community" },
    ...boards.map((k) => ({
      key: k,
      label: communityTabLabelForBoard(k, config),
      href: communityBoardListHref(k),
    })),
  ];
}
