import type { SiteCommunityBoardKey } from "../../../lib/server/dev-store";

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

export function isPrimaryTabKey(k: SiteCommunityBoardKey): k is keyof typeof COMMUNITY_PRIMARY_TAB_LABEL {
  return k in COMMUNITY_PRIMARY_TAB_LABEL;
}
