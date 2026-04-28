/** Next `revalidateTag` / `unstable_cache` 태그 — 공개 사이트 데이터 캐시 무효화용 */
export const CACHE_TAG_SITE_LAYOUT_CONFIG = "site-data:layout-config";
export const CACHE_TAG_SITE_VENUES_BOARD_ROWS = "site-data:venues-board-rows";
export const CACHE_TAG_SITE_COMMUNITY_CONFIG = "site-data:community-config";

export function cacheTagTournamentById(tournamentId: string): string {
  return `site-data:tournament:${tournamentId.trim()}`;
}
