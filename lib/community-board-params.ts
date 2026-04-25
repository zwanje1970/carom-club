import type { SiteCommunityBoardKey } from "./types/entities";

const SITE_COMMUNITY_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1", "extra2"];

function isSiteCommunityBoardKey(value: unknown): value is SiteCommunityBoardKey {
  return typeof value === "string" && SITE_COMMUNITY_BOARD_KEYS.includes(value as SiteCommunityBoardKey);
}

export function parseCommunityBoardTypeParam(raw: string): SiteCommunityBoardKey | null {
  const t = raw.trim();
  return isSiteCommunityBoardKey(t) ? t : null;
}

export const COMMUNITY_PRIMARY_BOARD_KEYS: SiteCommunityBoardKey[] = ["free", "qna", "reviews", "extra1"];
