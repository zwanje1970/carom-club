"use client";

import Link from "next/link";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListImage160 from "../components/SiteListImage160";
import TournamentsFilterBar from "./tournaments-filter-bar";
import type { TournamentStatusFilter } from "./tournament-list-url";

export type SiteTournamentListRow = {
  id: string;
  statusBadge: string;
  title: string;
  scheduleLine: string;
  locationLine: string;
  bracketParen: string | null;
  posterSrc: string | null;
};

function tournamentStatusBadgeClassName(statusBadge: string): string {
  const s = statusBadge.trim();
  if (s === "모집중") return "badge-status";
  if (s === "마감임박") return "site-board-status-badge site-board-status-badge--urgent";
  if (s === "마감") return "site-board-status-badge site-board-status-badge--closed";
  if (s === "종료") return "site-board-status-badge site-board-status-badge--ended";
  return "site-board-status-badge site-board-status-badge--muted";
}

type Props = {
  rows: SiteTournamentListRow[];
  searchParams: Record<string, string | string[] | undefined>;
  currentStatus: TournamentStatusFilter;
};

export default function SiteTournamentsDistanceShell({ rows, searchParams, currentStatus }: Props) {
  return (
    <SiteShellFrame
      brandTitle="대회안내"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={<TournamentsFilterBar searchParams={searchParams} currentStatus={currentStatus} />}
    >
      <section className="site-site-gray-main v3-stack">
        {rows.length === 0 ? (
          <p className="v3-muted">등록된 대회가 없습니다.</p>
        ) : (
          <ul className="site-board-card-list">
            {rows.map((tournament) => (
              <li key={tournament.id} className="site-board-card">
                <Link prefetch={false} href={`/site/tournaments/${tournament.id}`}>
                  <div className="site-tournament-card-main">
                    <span className={tournamentStatusBadgeClassName(tournament.statusBadge)}>
                      {tournament.statusBadge}
                    </span>
                    <strong className="site-tournament-card-title">{tournament.title}</strong>
                    {tournament.scheduleLine ? (
                      <span className="site-tournament-schedule">{tournament.scheduleLine}</span>
                    ) : null}
                    {tournament.locationLine ? (
                      <span className="site-tournament-location">{tournament.locationLine}</span>
                    ) : null}
                    {tournament.bracketParen ? (
                      <div className="site-tournament-chips">
                        <span className="site-list-chip">{tournament.bracketParen}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="site-tournament-list-thumb">
                    {tournament.posterSrc ? (
                      <SiteListImage160
                        src={tournament.posterSrc}
                        alt={`${tournament.title} 포스터`}
                        placeholderClassName="site-tournament-list-thumb-placeholder"
                      />
                    ) : (
                      <div className="site-tournament-list-thumb-placeholder">이미지 없음</div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShellFrame>
  );
}
