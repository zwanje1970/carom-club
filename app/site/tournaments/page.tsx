import { SITE_TOURNAMENT_LIST_EXCLUDED_BADGES } from "../../../lib/site-tournament-badges";
import {
  formatTournamentScheduleLabel,
  resolveSitePosterDisplayUrl,
  type Tournament,
} from "../../../lib/server/dev-store";
import { listAllTournamentsFirestore } from "../../../lib/server/firestore-tournaments";
import SiteTournamentsDistanceShell, { type SiteTournamentListRow } from "./SiteTournamentsDistanceShell";
import { parseTournamentStatusFilter } from "./tournament-list-url";

export const dynamic = "force-dynamic";

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
  const statusFilter = parseTournamentStatusFilter(resolvedSearchParams.status);

  const tournaments = await listAllTournamentsFirestore();

  let ordered = tournaments.filter((t) => !SITE_TOURNAMENT_LIST_EXCLUDED_BADGES.has(t.statusBadge));
  if (statusFilter !== "all") {
    ordered = ordered.filter((t) => t.statusBadge === statusFilter);
  }

  ordered.sort((a, b) => tournamentDeadlineSortValue(a).localeCompare(tournamentDeadlineSortValue(b)));

  const rows: SiteTournamentListRow[] = ordered.map((tournament) => ({
    id: tournament.id,
    statusBadge: tournament.statusBadge,
    title: tournament.title,
    scheduleLine: tournamentListScheduleLine(tournament),
    locationLine: tournamentLocationLine(tournament),
    bracketParen: tournamentBracketParen(tournament),
    posterSrc: resolveSitePosterDisplayUrl(tournament.posterImageUrl),
  }));

  return (
    <SiteTournamentsDistanceShell
      rows={rows}
      searchParams={resolvedSearchParams}
      currentStatus={statusFilter}
    />
  );
}
