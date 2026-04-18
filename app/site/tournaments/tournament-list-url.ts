export type TournamentSortType = "DEADLINE" | "DISTANCE";

export const TOURNAMENT_STATUS_FILTER_OPTIONS = ["모집중", "마감임박", "마감", "종료"] as const;
export type TournamentStatusFilterOption = (typeof TOURNAMENT_STATUS_FILTER_OPTIONS)[number];
export type TournamentStatusFilter = "all" | TournamentStatusFilterOption;

export function parseTournamentStatusFilter(
  raw: string | string[] | undefined
): TournamentStatusFilter {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || s === "all") return "all";
  if ((TOURNAMENT_STATUS_FILTER_OPTIONS as readonly string[]).includes(s)) {
    return s as TournamentStatusFilterOption;
  }
  return "all";
}

export function buildTournamentListHref(
  searchParams: Record<string, string | string[] | undefined>,
  patch: {
    status?: string | null;
    sort?: TournamentSortType;
  } = {}
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
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
    next.set("sort", patch.sort);
    if (patch.sort !== "DISTANCE") {
      next.delete("distanceLat");
      next.delete("distanceLng");
      next.delete("distanceDenied");
    }
  }
  const q = next.toString();
  return q ? `?${q}` : "";
}
