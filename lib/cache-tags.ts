/** Next `revalidateTag` / `unstable_cache` 태그 — 공개 사이트 데이터 캐시 무효화용 */
export const CACHE_TAG_SITE_LAYOUT_CONFIG = "site-data:layout-config";
export const CACHE_TAG_SITE_VENUES_BOARD_ROWS = "site-data:venues-board-rows";
export const CACHE_TAG_SITE_COMMUNITY_CONFIG = "site-data:community-config";
export const CACHE_TAG_SITE_NOTICE = "site-data:notice";
export const CACHE_TAG_MAIN_SLIDE_ADS = "site-data:main-slide-ads";
export const CACHE_TAG_MAIN_SLIDE_SNAPSHOTS = "site-data:main-slide-snapshots";

/** 공개 `/site/tournaments` 목록 전용 — `revalidateTag` 연동 시 사용 */
export const CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST = "site-data:public-tournaments-list";

/** 공개 사이트 커뮤니티 목록 피드 전용 — `revalidateTag` 연동 시 사용 */
export const CACHE_TAG_SITE_PUBLIC_COMMUNITY_FEED = "site-data:public-community-feed";

export function cacheTagTournamentById(tournamentId: string): string {
  return `site-data:tournament:${tournamentId.trim()}`;
}
