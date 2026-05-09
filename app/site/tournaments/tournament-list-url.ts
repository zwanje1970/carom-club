export type TournamentSortType = "DEADLINE" | "DISTANCE";

/** 목록 상단 탭 4개(전체 + 아래 3) — UI·필터 공통 */
export const TOURNAMENT_STATUS_TAB_VALUES = ["모집중", "마감", "종료"] as const;
export type TournamentStatusTabValue = (typeof TOURNAMENT_STATUS_TAB_VALUES)[number];
export type TournamentStatusFilter = "all" | TournamentStatusTabValue;

export function parseTournamentStatusFilter(
  raw: string | string[] | undefined
): TournamentStatusFilter {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s === "all") return "all";
  /** 예전 `?status=마감임박` 링크는 모집중 탭 필터와 동일하게 동작 */
  if (s === "마감임박") return "모집중";
  if ((TOURNAMENT_STATUS_TAB_VALUES as readonly string[]).includes(s)) {
    return s as TournamentStatusTabValue;
  }
  return "all";
}

export function buildTournamentListHref(
  searchParams: Record<string, string | string[] | undefined>,
  patch: {
    status?: string | null;
    sort?: TournamentSortType | null;
  } = {}
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "distanceLat" || key === "distanceLng" || key === "distanceDenied") continue;
    if (key === "sort" && value === "DISTANCE") continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else if (typeof value === "string") {
      next.set(key, value);
    }
  }
  if ("status" in patch) {
    const st = patch.status;
    if (st === null || st === undefined || st === "all" || st === "") {
      next.delete("status");
    } else {
      next.set("status", st);
    }
  }
  if ("sort" in patch && patch.sort !== undefined) {
    if (patch.sort === null || patch.sort === "DISTANCE") {
      next.delete("sort");
    } else {
      next.set("sort", patch.sort);
    }
  }
  if (next.get("sort") === "DISTANCE") {
    next.delete("sort");
  }
  next.delete("distanceLat");
  next.delete("distanceLng");
  next.delete("distanceDenied");
  const q = next.toString();
  return q ? `?${q}` : "";
}
