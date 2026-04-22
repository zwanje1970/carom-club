"use client";

import { useRouter } from "next/navigation";
import FilterButton from "../components/FilterButton";
import FilterDropdown from "../components/FilterDropdown";
import filterStyles from "../components/filter-controls.module.css";
import { performGeolocationThenNavigate } from "../lib/site-geolocation-flow";
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
  distanceSortActive: boolean;
};

export default function TournamentsFilterBar({
  searchParams,
  currentStatus,
  distanceSortHref,
  hasViewerCoordinate,
  distanceSortActive,
}: Props) {
  const router = useRouter();

  const selectValue = currentStatus === "all" ? "all" : currentStatus;

  return (
    <div className={`${filterStyles.filterRow} ${filterStyles.filterRowSingle} ${filterStyles.filterRowFilterPack}`}>
      <div className={filterStyles.filterField}>
        <span className={filterStyles.filterFieldLabel}>상태</span>
        <FilterDropdown
          className={filterStyles.dropdownFlex}
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
      </div>
      <FilterButton
        className={distanceSortActive ? filterStyles.buttonDistanceActive : undefined}
        href={`/site/tournaments${distanceSortHref}`}
        useNextLink={hasViewerCoordinate}
        onClick={
          hasViewerCoordinate
            ? undefined
            : (e) => {
                e.preventDefault();
                performGeolocationThenNavigate(`/site/tournaments${distanceSortHref}`, (path) =>
                  router.push(path),
                );
              }
        }
      >
        거리순
      </FilterButton>
    </div>
  );
}
