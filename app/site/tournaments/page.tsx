import { SITE_TOURNAMENT_LIST_EXCLUDED_BADGES } from "../../../lib/site-tournament-badges";
import { Suspense } from "react";
import { listSitePublicTournamentListSnapshotsForPublicSite } from "../../../lib/surface-read";
import SiteTournamentsDistanceShell, { type SiteTournamentListRow } from "./SiteTournamentsDistanceShell";
import { parseTournamentStatusFilter } from "./tournament-list-url";
import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";

export const dynamic = "force-dynamic";

export default function SiteTournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<SiteDetailShellBodyLoader />}>
      <SiteTournamentsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteTournamentsPageContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [resolvedSearchParams, snapshots] = await Promise.all([
    searchParams ?? Promise.resolve<Record<string, string | string[] | undefined>>({}),
    listSitePublicTournamentListSnapshotsForPublicSite(),
  ]);
  const statusFilter = parseTournamentStatusFilter(resolvedSearchParams.status);

  let ordered = snapshots.filter((s) => !SITE_TOURNAMENT_LIST_EXCLUDED_BADGES.has(s.statusBadge));
  if (statusFilter !== "all") {
    if (statusFilter === "모집중") {
      ordered = ordered.filter((s) => s.statusBadge === "모집중" || s.statusBadge === "마감임박");
    } else {
      ordered = ordered.filter((s) => s.statusBadge === statusFilter);
    }
  }

  ordered.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const rows: SiteTournamentListRow[] = ordered.map((s) => {
    const reg = (s.regionLabel ?? "").trim();
    const ven = (s.venueName ?? "").trim();
    const locationLine = reg && ven ? `[${reg}] ${ven}` : ven || (reg ? `[${reg}]` : "");
    return {
      id: s.tournamentId,
      statusBadge: s.statusBadge,
      title: s.title,
      scheduleLine: s.dateLabel,
      locationLine,
      bracketParen: s.playScaleLabel.trim() ? s.playScaleLabel : null,
      posterSrc: s.thumbnail160Url,
      tournamentTypeLabel: s.tournamentTypeLabel ?? "",
      firstPrizeLabel: s.firstPrizeLabel ?? "",
      deadlineLabel: s.deadlineLabel ?? "",
    };
  });

  return <SiteTournamentsDistanceShell rows={rows} searchParams={resolvedSearchParams} currentStatus={statusFilter} />;
}
