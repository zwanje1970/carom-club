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
  getTournamentsListRaw,
  getVenuesForCarousel,
  type TournamentListRow,
  type VenueCarouselRow,
} from "@/lib/db-tournaments";
import { MOCK_TOURNAMENTS_LIST, MOCK_VENUES_LIST } from "@/lib/mock-data";
import type { SiteSettings } from "@/lib/site-settings";
import type { HomeSlotRenderContextPayload } from "@/types/page-slot-render-context";

const HOME_SLOT_REVALIDATE_SECONDS = 60;
const HOME_INITIAL_TOURNAMENT_TAKE = 4;
const HOME_VENUE_CAROUSEL_TAKE = 16;

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
  initialTournaments: TournamentListRow[];
  carouselVenues: VenueCarouselRow[];
  showNoteEntry: boolean;
  showSolverEntry: boolean;
};

type HomeSlotDbData = Pick<HomeSlotBlocksData, "initialTournaments" | "carouselVenues">;

async function loadHomeSlotDbDataUncached(): Promise<HomeSlotDbData> {
  if (isDatabaseConfigured()) {
    const [tList, cList] = await Promise.all([
      getTournamentsListRaw({ orderBy: "asc", take: HOME_INITIAL_TOURNAMENT_TAKE }),
      getVenuesForCarousel(HOME_VENUE_CAROUSEL_TAKE),
    ]);
    return {
      initialTournaments:
        tList.length > 0 ? tList : (MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[]),
      carouselVenues: cList,
    };
  }

  return {
    initialTournaments: MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[],
    carouselVenues: MOCK_VENUES_LIST.map((v, i) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      logoImageUrl: null as string | null,
      coverImageUrl: null as string | null,
      venueCategory: (i === 0 ? "daedae_only" : "mixed") as VenueCarouselRow["venueCategory"],
    })),
  };
}

const loadHomeSlotDbDataCached = unstable_cache(
  loadHomeSlotDbDataUncached,
  ["home-slot-db-data"],
  { revalidate: HOME_SLOT_REVALIDATE_SECONDS, tags: ["home-slot-data"] }
);

export async function loadHomeSlotBlocksData(): Promise<HomeSlotBlocksData> {
  const session = await getSession();
  const showNoteEntry = canShowNoteEntryFromSession(session);
  const showSolverEntry = await canShowHomeSolverEntry(session);
  const dbData = await loadHomeSlotDbDataCached();

  return {
    initialTournaments: dbData.initialTournaments,
    carouselVenues: dbData.carouselVenues,
    showNoteEntry,
    showSolverEntry,
  };
}

export async function buildHomeSlotRenderPayload(input: {
  copy: Record<string, string>;
  siteSettings: SiteSettings;
}): Promise<HomeSlotRenderContextPayload> {
  const base = await loadHomeSlotBlocksData();
  return {
    ...base,
    copy: input.copy,
    siteSettings: input.siteSettings,
  };
}
