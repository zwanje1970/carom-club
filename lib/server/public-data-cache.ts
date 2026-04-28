import { unstable_cache } from "next/cache";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
import {
  getSiteCommunityConfig as getSiteCommunityConfigUncached,
  getSiteLayoutConfig as getSiteLayoutConfigUncached,
  getSiteVenuesBoardRows as getSiteVenuesBoardRowsUncached,
} from "./platform-backing-store";
import {
  CACHE_TAG_SITE_COMMUNITY_CONFIG,
  CACHE_TAG_SITE_LAYOUT_CONFIG,
  CACHE_TAG_SITE_VENUES_BOARD_ROWS,
  cacheTagTournamentById,
} from "../cache-tags";

export const getSiteLayoutConfig = unstable_cache(
  async () => getSiteLayoutConfigUncached(),
  ["site-layout-config"],
  { tags: [CACHE_TAG_SITE_LAYOUT_CONFIG] }
);

export const getSiteVenuesBoardRows = unstable_cache(
  async () => getSiteVenuesBoardRowsUncached(),
  ["site-venues-board-rows"],
  { tags: [CACHE_TAG_SITE_VENUES_BOARD_ROWS] }
);

export const getSiteCommunityConfig = unstable_cache(
  async () => getSiteCommunityConfigUncached(),
  ["site-community-config"],
  { tags: [CACHE_TAG_SITE_COMMUNITY_CONFIG] }
);

/** 공개 사이트 RSC용 — 클라이언트 대회 수정 경로의 `getTournamentByIdFirestore`는 비캐시 유지 */
export async function getTournamentByIdForPublicSitePage(tournamentId: string): Promise<
  Awaited<ReturnType<typeof getTournamentByIdFirestore>>
> {
  const id = tournamentId.trim();
  if (!id) return null;
  return unstable_cache(
    async () => getTournamentByIdFirestore(id),
    ["site-tournament-public", id],
    { tags: [cacheTagTournamentById(id)] }
  )();
}
