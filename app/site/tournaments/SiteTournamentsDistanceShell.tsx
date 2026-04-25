"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import SiteShellFrame from "../components/SiteShellFrame";
import {
  confirmSiteGeolocationPrecursor,
  fetchViewerCoordinatesOnce,
  SITE_GEO_DENIED_USER_MESSAGE,
} from "../lib/site-geolocation-flow";
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
  const [memoryCoords, setMemoryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showDeniedHint, setShowDeniedHint] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  useEffect(() => {
    return () => {
      setMemoryCoords(null);
      setShowDeniedHint(false);
      setGeoBusy(false);
    };
  }, []);

  const onDistanceClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (geoBusy) return;
      const isRefresh = memoryCoords != null;
      if (!isRefresh) {
        if (!confirmSiteGeolocationPrecursor()) return;
      }
      setGeoBusy(true);
      setShowDeniedHint(false);
      const c = await fetchViewerCoordinatesOnce();
      setGeoBusy(false);
      if (c) {
        setMemoryCoords(c);
        setShowDeniedHint(false);
      } else {
        setMemoryCoords(null);
        setShowDeniedHint(true);
      }
    },
    [geoBusy, memoryCoords],
  );

  return (
    <SiteShellFrame
      brandTitle="대회안내"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <TournamentsFilterBar
          searchParams={searchParams}
          currentStatus={currentStatus}
          distanceSortActive={memoryCoords != null}
          onDistanceClick={onDistanceClick}
        />
      }
    >
      <section className="site-site-gray-main v3-stack">
        {showDeniedHint ? (
          <p
            role="status"
            className="v3-muted"
            style={{
              margin: "0 0 1rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "8px",
              background: "var(--v3-surface-2, #eef0f3)",
              fontSize: "0.9rem",
              lineHeight: 1.45,
            }}
          >
            {SITE_GEO_DENIED_USER_MESSAGE}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="v3-muted">등록된 대회가 없습니다.</p>
        ) : (
          <ul className="site-board-card-list">
            {rows.map((tournament) => (
              <li key={tournament.id} className="site-board-card">
                <Link href={`/site/tournaments/${tournament.id}`}>
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
                      <img src={tournament.posterSrc} alt={`${tournament.title} 포스터`} loading="lazy" />
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
