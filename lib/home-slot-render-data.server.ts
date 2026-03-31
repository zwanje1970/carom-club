import "server-only";

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

export async function loadHomeSlotBlocksData(): Promise<HomeSlotBlocksData> {
  let tournaments: TournamentListRow[] = [];
  let carouselVenues: VenueCarouselRow[] = [];
  const session = await getSession();
  const showNoteEntry = canShowNoteEntryFromSession(session);
  const showSolverEntry = await canShowHomeSolverEntry(session);

  if (isDatabaseConfigured()) {
    const [tList, cList] = await Promise.all([
      getTournamentsListRaw({ orderBy: "asc", take: 4 }),
      getVenuesForCarousel(50),
    ]);
    tournaments = tList.length > 0 ? tList : (MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[]);
    carouselVenues = cList;
  } else {
    tournaments = MOCK_TOURNAMENTS_LIST as unknown as TournamentListRow[];
    carouselVenues = MOCK_VENUES_LIST.map((v, i) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      logoImageUrl: null as string | null,
      coverImageUrl: null as string | null,
      venueCategory: (i === 0 ? "daedae_only" : "mixed") as VenueCarouselRow["venueCategory"],
    }));
  }

  return {
    initialTournaments: tournaments,
    carouselVenues,
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
