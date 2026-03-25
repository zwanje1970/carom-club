/**
 * 공개 대회 목록 — /api/public/tournaments 와 /tournaments 페이지 SSR이 동일 로직을 쓰도록 공유.
 */

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getTournamentsListForPublicPage,
  type TournamentsListSort,
  type TournamentsListTab,
} from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";

export const PUBLIC_TOURNAMENTS_TABS: TournamentsListTab[] = ["upcoming", "closed", "finished"];
const SORTS_UPCOMING: TournamentsListSort[] = ["distance", "deadline", "date"];
const SORTS_OTHER: TournamentsListSort[] = ["distance", "date"];

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

/** Next.js page `searchParams` 또는 URLSearchParams 모두에서 동일 파싱 */
/** 목록 1페이지 기본 크기(무한 스크롤 청크) */
export const PUBLIC_TOURNAMENTS_PAGE_SIZE = 20;

export function parsePublicTournamentsQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): {
  tab: TournamentsListTab;
  sortBy: TournamentsListSort;
  nationalOnly: boolean;
  take: number;
  skip: number;
  latFromQuery: number;
  lngFromQuery: number;
} {
  const get = (key: string) =>
    input instanceof URLSearchParams
      ? input.get(key) ?? undefined
      : firstParam((input as Record<string, string | string[] | undefined>)[key]);

  const tabRaw = get("tab") || "upcoming";
  const tab = (
    PUBLIC_TOURNAMENTS_TABS.includes(tabRaw as TournamentsListTab) ? tabRaw : "upcoming"
  ) as TournamentsListTab;
  const sortByRaw = get("sortBy") || "date";
  const sortBy = sortByRaw as TournamentsListSort;
  const nationalOnly = get("national") === "1";
  const takeRaw = Number(get("take"));
  const take = Math.min(
    Number.isFinite(takeRaw) && takeRaw > 0 ? takeRaw : PUBLIC_TOURNAMENTS_PAGE_SIZE,
    200
  );
  const skipRaw = Number(get("skip"));
  const skip = Math.max(
    0,
    Math.min(Number.isFinite(skipRaw) && skipRaw >= 0 ? Math.floor(skipRaw) : 0, 10_000)
  );
  const latFromQuery = Number(get("lat"));
  const lngFromQuery = Number(get("lng"));

  const allowedSorts = tab === "upcoming" ? SORTS_UPCOMING : SORTS_OTHER;
  const effectiveSort = allowedSorts.includes(sortBy) ? sortBy : "date";

  return {
    tab,
    sortBy: effectiveSort,
    nationalOnly,
    take,
    skip,
    latFromQuery,
    lngFromQuery,
  };
}

export type PublicTournamentsListRow = Awaited<
  ReturnType<typeof getTournamentsListForPublicPage>
>[number];

/**
 * 공개 대회 목록(한 번의 DB 조회). API 라우트·서버 페이지에서 공통 사용.
 */
export async function getPublicTournamentsListFromQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>
): Promise<{ ok: true; list: PublicTournamentsListRow[] }> {
  if (!isDatabaseConfigured()) {
    return { ok: true, list: [] };
  }

  const parsed = parsePublicTournamentsQuery(input);

  let lat = parsed.latFromQuery;
  let lng = parsed.lngFromQuery;

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && (lat !== 0 || lng !== 0)) {
    const session = await getSession();
    if (session?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.id },
        select: { latitude: true, longitude: true },
      });
      if (user?.latitude != null && user?.longitude != null) {
        lat = user.latitude;
        lng = user.longitude;
      }
    }
  }

  const list = await getTournamentsListForPublicPage({
    tab: parsed.tab,
    sortBy: parsed.sortBy,
    nationalOnly: parsed.nationalOnly,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
    take: parsed.take,
    skip: parsed.skip,
  });

  return { ok: true, list };
}
