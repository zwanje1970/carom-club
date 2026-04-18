import Link from "next/link";
import Script from "next/script";
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
  return `${m[1]}.${m[2]}.${m[3]}(${WEEKDAYS_KO[d.getDay()]})`;
}

/** 목록 날짜 줄: 단일 일정은 YYYY.MM.DD(요일), 복수는 일정 라벨(날짜만 점 표기) */
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
      prependMain={
        <Script id="site-tournaments-distance-geolocation" strategy="afterInteractive">
          {`
          (() => {
            if (typeof window === "undefined") return;
            document.addEventListener("click", (event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;
              const trigger = target.closest("a[data-distance-trigger='true']");
              if (!(trigger instanceof HTMLAnchorElement)) return;
              event.preventDefault();

              const moveWithDenied = () => {
                const deniedUrl = new URL(trigger.href, window.location.origin);
                deniedUrl.searchParams.set("distanceDenied", "1");
                deniedUrl.searchParams.delete("distanceLat");
                deniedUrl.searchParams.delete("distanceLng");
                window.location.assign(deniedUrl.pathname + deniedUrl.search + deniedUrl.hash);
              };

              if (!("geolocation" in navigator)) {
                moveWithDenied();
                return;
              }

              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const okUrl = new URL(trigger.href, window.location.origin);
                  okUrl.searchParams.set("distanceLat", String(position.coords.latitude));
                  okUrl.searchParams.set("distanceLng", String(position.coords.longitude));
                  okUrl.searchParams.delete("distanceDenied");
                  window.location.assign(okUrl.pathname + okUrl.search + okUrl.hash);
                },
                () => moveWithDenied(),
                { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
              );
            });
          })();
        `}
        </Script>
      }
      brandTitle="대회안내"
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
              <Link
                href={`/site/tournaments/${tournament.id}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <div style={{ minWidth: 0, flex: "1 1 auto" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      lineHeight: 1.2,
                      padding: "0.2rem 0.45rem",
                      borderRadius: "999px",
                      border: "1px solid var(--v3-border, #e5e7eb)",
                      background: "#f1f5f9",
                      color: "#334155",
                      whiteSpace: "nowrap",
                      marginBottom: "0.35rem",
                    }}
                  >
                    {tournament.statusBadge}
                  </span>
                  <strong
                    style={{
                      display: "block",
                      fontSize: "1.05rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginBottom: "0.5rem",
                    }}
                  >
                    {tournament.title}
                    {bracketParen ? ` (${bracketParen})` : ""}
                  </strong>
                  {scheduleLine ? (
                    <span
                      style={{
                        display: "block",
                        marginTop: 0,
                        fontSize: "0.92rem",
                        color: "#334155",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {scheduleLine}
                    </span>
                  ) : null}
                  {locationLine ? (
                    <span
                      className="v3-muted"
                      style={{
                        display: "block",
                        marginTop: "0.25rem",
                        fontSize: "0.875rem",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {locationLine}
                    </span>
                  ) : null}
                </div>
                {posterSrc ? (
                  <img
                    src={posterSrc}
                    alt={`${tournament.title} 포스터`}
                    loading="lazy"
                    style={{
                      width: "96px",
                      maxWidth: "96px",
                      height: "auto",
                      maxHeight: "128px",
                      display: "block",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "96px",
                      height: "128px",
                      background: "#e5e7eb",
                      color: "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.8rem",
                      marginLeft: "auto",
                      flexShrink: 0,
                    }}
                  >
                    이미지 없음
                  </div>
                )}
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
