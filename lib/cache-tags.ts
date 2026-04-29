/** Next `revalidateTag` / `unstable_cache` 태그 — 공개 사이트 데이터 캐시 무효화용 */
export const CACHE_TAG_SITE_LAYOUT_CONFIG = "site-data:layout-config";
export const CACHE_TAG_SITE_VENUES_BOARD_ROWS = "site-data:venues-board-rows";
export const CACHE_TAG_SITE_COMMUNITY_CONFIG = "site-data:community-config";
export const CACHE_TAG_SITE_NOTICE = "site-data:notice";
export const CACHE_TAG_MAIN_SLIDE_ADS = "site-data:main-slide-ads";
export const CACHE_TAG_MAIN_SLIDE_SNAPSHOTS = "site-data:main-slide-snapshots";

export function cacheTagTournamentById(tournamentId: string): string {
  return `site-data:tournament:${tournamentId.trim()}`;
}
