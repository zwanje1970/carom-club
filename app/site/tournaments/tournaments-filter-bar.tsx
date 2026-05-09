"use client";

import Link from "next/link";
import {
  buildTournamentListHref,
  TOURNAMENT_STATUS_TAB_VALUES,
  type TournamentStatusFilter,
} from "./tournament-list-url";

const STATUS_SEGMENTS: { value: TournamentStatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  ...TOURNAMENT_STATUS_TAB_VALUES.map((s) => ({ value: s, label: s })),
];

type Props = {
  searchParams: Record<string, string | string[] | undefined>;
  currentStatus: TournamentStatusFilter;
};

export default function TournamentsFilterBar({ searchParams, currentStatus }: Props) {
  return (
    <div className="site-list-filter-bar site-tournament-status-filter">
      <nav className="site-tournament-status-filter__track" aria-label="대회 상태">
        {STATUS_SEGMENTS.map(({ value, label }) => {
          const q = buildTournamentListHref(searchParams, {
            status: value === "all" ? null : value,
          });
          const href = q ? `/site/tournaments${q}` : "/site/tournaments";
          const active = currentStatus === value;
          return (
            <Link
              key={value}
              prefetch={false}
              href={href}
              className={`site-tournament-status-filter__tab${active ? " site-tournament-status-filter__tab--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
