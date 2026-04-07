import "server-only";
import { unstable_cache } from "next/cache";

import { getSession } from "@/lib/auth";
import {
  getLegacyFallbackPermissions,
  PERMISSION_KEYS,
  type PermissionSubject,
} from "@/lib/auth/permissions";
import { canShowNoteEntryFromSession } from "@/lib/entry-visibility";
import { isDatabaseConfigured } from "@/lib/db-mode";
import {
  getVenuesForCarousel,
  type VenueCarouselRow,
} from "@/lib/db-tournaments";
import {
  getHomePublishedTournamentCards,
} from "@/lib/home-published-tournament-cards.server";
import type { HomePublishedTournamentCard } from "@/lib/home-published-tournament-cards";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";
import type { SiteSettings } from "@/lib/site-settings";
import type { HomeSlotRenderContextPayload } from "@/types/page-slot-render-context";

const HOME_SLOT_REVALIDATE_SECONDS = 60;
const HOME_INITIAL_TOURNAMENT_TAKE = 6;
const HOME_VENUE_CAROUSEL_TAKE = 16;
const HOME_SLOT_CACHE_TAG = "home-slot-data";

async function canShowHomeSolverEntry(session: PermissionSubject): Promise<boolean> {
  if (!session) return false;
  if (!session.roleId) {
    return getLegacyFallbackPermissions(session.role).includes(
      PERMISSION_KEYS.COMMUNITY_POST_CREATE
    );
  }
  const { hasPermission } = await import("@/lib/auth/permissions.server");
  return hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE);
}

/** 홈 구조 슬롯(`tournamentIntro` 등)에 넣는 DB·세션 기반 데이터 */
export type HomeSlotBlocksData = {
  initialTournaments: HomePublishedTournamentCard[];
  carouselVenues: VenueCarouselRow[];
  showNoteEntry: boolean;
  showSolverEntry: boolean;
};

type HomeSlotDbData = Pick<HomeSlotBlocksData, "initialTournaments" | "carouselVenues">;

type HomeSlotDataNeeds = {
  requireTournaments: boolean;
  requireVenues: boolean;
};

async function loadHomeSlotDbDataUncached(needs: HomeSlotDataNeeds): Promise<HomeSlotDbData> {
  if (isDatabaseConfigured()) {
    const [tList, cList] = await Promise.all([
      needs.requireTournaments
        ? getHomePublishedTournamentCards({
            sortBy: "latest",
            take: HOME_INITIAL_TOURNAMENT_TAKE,
          })
        : Promise.resolve([] as HomePublishedTournamentCard[]),
      needs.requireVenues
        ? getVenuesForCarousel(HOME_VENUE_CAROUSEL_TAKE)
        : Promise.resolve([] as VenueCarouselRow[]),
    ]);
    return {
      initialTournaments: tList,
      carouselVenues: cList,
    };
  }

  return {
    initialTournaments: needs.requireTournaments ? ([] as HomePublishedTournamentCard[]) : [],
    carouselVenues: needs.requireVenues
      ? MOCK_VENUES_LIST.map((v, i) => ({
          id: v.id,
          name: v.name,
          slug: v.slug,
          logoImageUrl: null as string | null,
          coverImageUrl: null as string | null,
          venueCategory: (i === 0 ? "daedae_only" : "mixed") as VenueCarouselRow["venueCategory"],
        }))
      : [],
  };
}

function loadHomeSlotDbDataCached(needs: HomeSlotDataNeeds): Promise<HomeSlotDbData> {
  const key = `t-${needs.requireTournaments ? 1 : 0}-v-${needs.requireVenues ? 1 : 0}`;
  return unstable_cache(
    () => loadHomeSlotDbDataUncached(needs),
    ["home-slot-db-data", key],
    { revalidate: HOME_SLOT_REVALIDATE_SECONDS, tags: [HOME_SLOT_CACHE_TAG] }
  )();
}

export async function loadHomeSlotBlocksData(options?: {
  requireTournaments?: boolean;
  requireVenues?: boolean;
  includeSessionFlags?: boolean;
}): Promise<HomeSlotBlocksData> {
  const needs: HomeSlotDataNeeds = {
    requireTournaments: options?.requireTournaments !== false,
    requireVenues: options?.requireVenues !== false,
  };
  const includeSessionFlags = options?.includeSessionFlags !== false;
  const [sessionInfo, dbData] = await Promise.all([
    includeSessionFlags
      ? (async () => {
          const session = await getSession();
          return {
            showNoteEntry: canShowNoteEntryFromSession(session),
            showSolverEntry: await canShowHomeSolverEntry(session),
          };
        })()
      : Promise.resolve({ showNoteEntry: false, showSolverEntry: false }),
    loadHomeSlotDbDataCached(needs),
  ]);

  return {
    initialTournaments: dbData.initialTournaments,
    carouselVenues: dbData.carouselVenues,
    showNoteEntry: sessionInfo.showNoteEntry,
    showSolverEntry: sessionInfo.showSolverEntry,
  };
}

export async function buildHomeSlotRenderPayload(input: {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
  requireTournaments?: boolean;
  requireVenues?: boolean;
  includeSessionFlags?: boolean;
}): Promise<HomeSlotRenderContextPayload> {
  const base = await loadHomeSlotBlocksData({
    requireTournaments: input.requireTournaments,
    requireVenues: input.requireVenues,
    includeSessionFlags: input.includeSessionFlags,
  });
  return {
    ...base,
    copy: input.copy,
    siteSettings: input.siteSettings,
  };
}
