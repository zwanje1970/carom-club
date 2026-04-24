import Link from "next/link";
import { SITE_TOURNAMENT_LIST_EXCLUDED_BADGES } from "../../../lib/site-tournament-badges";
import {
  formatTournamentScheduleLabel,
  listAllTournaments,
  resolveSitePosterDisplayUrl,
  type Tournament,
} from "../../../lib/server/dev-store";
import SiteShellFrame from "../components/SiteShellFrame";
import TournamentsFilterBar from "./tournaments-filter-bar";
import { buildTournamentListHref, parseTournamentStatusFilter } from "./tournament-list-url";

export const dynamic = "force-dynamic";

type TournamentSortType = "DEADLINE" | "DISTANCE";

function parseNumber(value: unknown): number | null {
  const next = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(next) ? next : null;
}

function normalizeCoordinate(lat: number, lng: number): { lat: number; lng: number } | null {
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function getTournamentCoordinate(_tournament: Tournament): { lat: number; lng: number } | null {
  return null;
}

function calculateDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}

function tournamentDeadlineSortValue(t: Tournament): string {
  const v = typeof t.date === "string" ? t.date.trim() : "";
  return v || "9999-12-31";
}

const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatSingleDateWithWeekday(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate.trim());
  if (!m) return isoDate;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${m[1]}.${m[2]}.${m[3]} (${WEEKDAYS_KO[d.getDay()]})`;
}

/** 목록 날짜 줄: 단일 일정은 YYYY.MM.DD (요일), 복수는 일정 라벨(날짜만 점 표기) */
function tournamentListScheduleLine(t: Tournament): string {
  const dates =
    t.eventDates && t.eventDates.length > 0
      ? [...t.eventDates]
      : t.date
        ? [t.date]
        : [];
  const sorted = dates.map((x) => x.trim()).filter(Boolean).sort();
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return formatSingleDateWithWeekday(sorted[0]!);
  const label = formatTournamentScheduleLabel(t);
  return label.replace(/\d{4}-\d{2}-\d{2}/g, (seg) => {
    const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(seg);
    return p ? `${p[1]}.${p[2]}.${p[3]}` : seg;
  });
}

function tournamentBracketParen(t: Tournament): string | null {
  const n = t.maxParticipants;
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${Math.floor(n)}강`;
}

function tournamentLocationLine(t: Tournament): string {
  return typeof t.location === "string" ? t.location.trim() : "";
}

/** 대회목록 상태 뱃지 — 모집중만 success(.badge-status), 나머지는 약한 톤 */
function tournamentStatusBadgeClassName(statusBadge: string): string {
  const s = statusBadge.trim();
  if (s === "모집중") return "badge-status";
  if (s === "마감임박") return "site-board-status-badge site-board-status-badge--urgent";
  if (s === "마감") return "site-board-status-badge site-board-status-badge--closed";
  if (s === "종료") return "site-board-status-badge site-board-status-badge--ended";
  return "site-board-status-badge site-board-status-badge--muted";
}

export default async function SiteTournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const sortRaw = resolvedSearchParams.sort;
  const sortType: TournamentSortType =
    typeof sortRaw === "string" && sortRaw === "DISTANCE" ? "DISTANCE" : "DEADLINE";
  const viewerLatRaw = resolvedSearchParams.distanceLat;
  const viewerLngRaw = resolvedSearchParams.distanceLng;
  const viewerLat = typeof viewerLatRaw === "string" ? parseNumber(viewerLatRaw) : null;
  const viewerLng = typeof viewerLngRaw === "string" ? parseNumber(viewerLngRaw) : null;
  const viewerCoordinate =
    viewerLat != null && viewerLng != null ? normalizeCoordinate(viewerLat, viewerLng) : null;

  const rawDenied = resolvedSearchParams.distanceDenied;
  const deniedStr = Array.isArray(rawDenied) ? rawDenied[0] : rawDenied;
  const locationDenied = deniedStr === "1" || deniedStr === "true";

  const statusFilter = parseTournamentStatusFilter(resolvedSearchParams.status);

  const tournaments = await listAllTournaments();

  let ordered = tournaments.filter((t) => !SITE_TOURNAMENT_LIST_EXCLUDED_BADGES.has(t.statusBadge));
  if (statusFilter !== "all") {
    ordered = ordered.filter((t) => t.statusBadge === statusFilter);
  }

  if (sortType === "DEADLINE") {
    ordered.sort((a, b) => tournamentDeadlineSortValue(a).localeCompare(tournamentDeadlineSortValue(b)));
  } else if (sortType === "DISTANCE" && viewerCoordinate) {
    const withDistance = ordered.map((tournament, index) => {
      const coordinate = getTournamentCoordinate(tournament);
      if (!coordinate) {
        return { tournament, index, distance: Number.POSITIVE_INFINITY };
      }
      return {
        tournament,
        index,
        distance: calculateDistanceMeters(viewerCoordinate, coordinate),
      };
    });
    const hasDistanceCandidate = withDistance.some((item) => Number.isFinite(item.distance));
    if (hasDistanceCandidate) {
      withDistance.sort((a, b) => {
        if (a.distance === b.distance) return a.index - b.index;
        return a.distance - b.distance;
      });
      ordered = withDistance.map((item) => item.tournament);
    }
  }

  const distanceSortHref = buildTournamentListHref(resolvedSearchParams, { sort: "DISTANCE" });

  return (
    <SiteShellFrame
      brandTitle="대회안내"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={
        <TournamentsFilterBar
          searchParams={resolvedSearchParams}
          currentStatus={statusFilter}
          distanceSortHref={distanceSortHref}
          hasViewerCoordinate={viewerCoordinate != null}
        />
      }
    >
      <section className="site-site-gray-main v3-stack">
        {sortType === "DISTANCE" && locationDenied ? (
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
            위치 권한을 허용해야 거리순으로 볼 수 있습니다. 브라우저 설정에서 위치를 허용한 뒤「거리순」을 다시 눌러 주세요.
          </p>
        ) : null}
      {ordered.length === 0 ? (
        <p className="v3-muted">등록된 대회가 없습니다.</p>
      ) : (
        <ul className="site-board-card-list">
          {ordered.map((tournament) => {
            const posterSrc = resolveSitePosterDisplayUrl(tournament.posterImageUrl);
            const bracketParen = tournamentBracketParen(tournament);
            const scheduleLine = tournamentListScheduleLine(tournament);
            const locationLine = tournamentLocationLine(tournament);
            return (
            <li key={tournament.id} className="site-board-card">
              <Link href={`/site/tournaments/${tournament.id}`}>
                <div className="site-tournament-card-main">
                  <span className={tournamentStatusBadgeClassName(tournament.statusBadge)}>
                    {tournament.statusBadge}
                  </span>
                  <strong className="site-tournament-card-title">{tournament.title}</strong>
                  {scheduleLine ? <span className="site-tournament-schedule">{scheduleLine}</span> : null}
                  {locationLine ? <span className="site-tournament-location">{locationLine}</span> : null}
                  {bracketParen ? (
                    <div className="site-tournament-chips">
                      <span className="site-list-chip">{bracketParen}</span>
                    </div>
                  ) : null}
                </div>
                <div className="site-tournament-list-thumb">
                  {posterSrc ? (
                    <img src={posterSrc} alt={`${tournament.title} 포스터`} loading="lazy" />
                  ) : (
                    <div className="site-tournament-list-thumb-placeholder">이미지 없음</div>
                  )}
                </div>
              </Link>
            </li>
            );
          })}
        </ul>
      )}
      </section>
    </SiteShellFrame>
  );
}
