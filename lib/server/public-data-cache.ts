import { unstable_cache } from "next/cache";
import { isEntityLifecycleVisibleForList } from "./entity-lifecycle";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
import {
  getSiteCommunityConfig as getSiteCommunityConfigUncached,
  getSiteLayoutConfig as getSiteLayoutConfigUncached,
  getSiteVenuesBoardRows as getSiteVenuesBoardRowsUncached,
  getSiteNotice as getSiteNoticeUncached,
  listTournamentSnapshotsForMainSite as listTournamentSnapshotsUncached,
  getMainSlideAdSettingsForSite as getMainSlideAdSettingsUncached,
} from "./platform-backing-store";
import {
  CACHE_TAG_SITE_COMMUNITY_CONFIG,
  CACHE_TAG_SITE_LAYOUT_CONFIG,
  CACHE_TAG_SITE_VENUES_BOARD_ROWS,
  CACHE_TAG_SITE_NOTICE,
  CACHE_TAG_MAIN_SLIDE_ADS,
  CACHE_TAG_MAIN_SLIDE_SNAPSHOTS,
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

export const getSiteNotice = unstable_cache(
  async () => getSiteNoticeUncached(),
  ["site-notice"],
  { tags: [CACHE_TAG_SITE_NOTICE] }
);

const _listTournamentSnapshotsCache = unstable_cache(
  async (limit: number | undefined) => listTournamentSnapshotsUncached({ limit }),
  ["main-slide-snapshots"],
  { tags: [CACHE_TAG_MAIN_SLIDE_SNAPSHOTS] }
);

export function listTournamentSnapshotsForMainSite(options?: { limit?: number }) {
  return _listTournamentSnapshotsCache(options?.limit);
}

export const getMainSlideAdSettingsForSite = unstable_cache(
  async () => getMainSlideAdSettingsUncached(),
  ["main-slide-ads"],
  { tags: [CACHE_TAG_MAIN_SLIDE_ADS] }
);

/** 공개 사이트 RSC용 — 클라이언트 대회 수정 경로의 `getTournamentByIdFirestore`는 비캐시 유지 */
export async function getTournamentByIdForPublicSitePage(tournamentId: string): Promise<
  Awaited<ReturnType<typeof getTournamentByIdFirestore>>
> {
  const id = tournamentId.trim();
  if (!id) return null;
  return unstable_cache(
    async () => {
      const t = await getTournamentByIdFirestore(id);
      if (!t) return null;
      if (!isEntityLifecycleVisibleForList(t.status)) return null;
      return t;
    },
    ["site-tournament-public", id],
    { tags: [cacheTagTournamentById(id)] }
  )();
}
