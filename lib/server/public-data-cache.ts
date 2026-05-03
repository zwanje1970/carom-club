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
  loadSiteCommunityFeedForPublicList,
  filterCommunityPostsAllPrimaryFromFeed,
  filterCommunityPostsFromFeed,
} from "./platform-backing-store";
import type { CommunityPostListItem, SiteCommunityBoardKey } from "../types/entities";
import {
  CACHE_TAG_SITE_COMMUNITY_CONFIG,
  CACHE_TAG_SITE_LAYOUT_CONFIG,
  CACHE_TAG_SITE_VENUES_BOARD_ROWS,
  CACHE_TAG_SITE_NOTICE,
  CACHE_TAG_MAIN_SLIDE_ADS,
  CACHE_TAG_MAIN_SLIDE_SNAPSHOTS,
  CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST,
  CACHE_TAG_SITE_PUBLIC_COMMUNITY_FEED,
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

export function listTournamentSnapshotsForMainSite(options?: { limit?: number }) {
  return listTournamentSnapshotsUncached({ limit: options?.limit });
}

export const getMainSlideAdSettingsForSite = unstable_cache(
  async () => getMainSlideAdSettingsUncached(),
  ["main-slide-ads"],
  { tags: [CACHE_TAG_MAIN_SLIDE_ADS] }
);

/** 공개 `/site/tournaments` — KV 스냅샷(미배포 시 lazy rebuild, 짧은 ISR) */
const _listSitePublicTournamentSnapshotsForPublicSite = unstable_cache(
  async () => {
    const { getSitePublicTournamentListSnapshotsWithLazyRebuild } = await import("./site-public-list-snapshots-kv");
    return getSitePublicTournamentListSnapshotsWithLazyRebuild();
  },
  ["public-site-tournament-list-snapshots-v2"],
  { revalidate: 60, tags: [CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST] }
);

export async function listSitePublicTournamentListSnapshotsForPublicSite() {
  return _listSitePublicTournamentSnapshotsForPublicSite();
}

/** 공개 사이트 커뮤니티 목록 — 피드 1회 로드 후 필터는 기존과 동일(짧은 ISR) */
const _loadSiteCommunityFeedForPublicList = unstable_cache(
  async () => loadSiteCommunityFeedForPublicList(),
  ["public-site-community-feed-v1"],
  { revalidate: 45, tags: [CACHE_TAG_SITE_PUBLIC_COMMUNITY_FEED] }
);

export async function listCommunityPostsAllPrimaryForPublicSite(
  visibleBoardKeys: SiteCommunityBoardKey[],
  options?: { q?: string }
): Promise<CommunityPostListItem[]> {
  const feed = await _loadSiteCommunityFeedForPublicList();
  return await filterCommunityPostsAllPrimaryFromFeed(feed, visibleBoardKeys, options);
}

export async function listCommunityPostsForPublicSite(
  boardType: SiteCommunityBoardKey,
  options?: { q?: string }
): Promise<CommunityPostListItem[]> {
  const feed = await _loadSiteCommunityFeedForPublicList();
  return await filterCommunityPostsFromFeed(feed, boardType, options);
}

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
