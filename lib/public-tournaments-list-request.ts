/**
 * 공개 대회 목록 shared 경계.
 * - 클라이언트와 서버가 함께 쓰는 상수·쿼리 파싱만 둡니다.
 * - DB/세션 조회는 `public-tournaments-list-request.server.ts`로 분리합니다.
 */

import type { TournamentsListSort, TournamentsListTab } from "@/lib/db-tournaments";

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

