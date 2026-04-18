"use client";

import { useRouter } from "next/navigation";
import FilterButton from "../components/FilterButton";
import FilterDropdown from "../components/FilterDropdown";
import filterStyles from "../components/filter-controls.module.css";
import {
  buildTournamentListHref,
  TOURNAMENT_STATUS_FILTER_OPTIONS,
  type TournamentStatusFilter,
} from "./tournament-list-url";

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
  currentStatus: TournamentStatusFilter;
  distanceSortHref: string;
  hasViewerCoordinate: boolean;
};

export default function TournamentsFilterBar({
  searchParams,
  currentStatus,
  distanceSortHref,
  hasViewerCoordinate,
}: Props) {
  const router = useRouter();

  const selectValue = currentStatus === "all" ? "all" : currentStatus;

  return (
    <div className={filterStyles.filterRow}>
      <FilterDropdown
        value={selectValue}
        aria-label="상태"
        onChange={(e) => {
          const v = e.target.value;
          const status = v === "all" ? null : v;
          const q = buildTournamentListHref(searchParams, { status });
          router.push(q ? `/site/tournaments${q}` : "/site/tournaments");
        }}
      >
        <option value="all">전체</option>
        {TOURNAMENT_STATUS_FILTER_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </FilterDropdown>
      <FilterButton
        href={`/site/tournaments${distanceSortHref}`}
        useNextLink={hasViewerCoordinate}
        {...(!hasViewerCoordinate ? { "data-distance-trigger": "true" as const } : {})}
      >
        위치순
      </FilterButton>
    </div>
  );
}
