import { SITE_TOURNAMENT_LIST_EXCLUDED_BADGES } from "../../../lib/site-tournament-badges";
import { Suspense } from "react";
import { listSitePublicTournamentListSnapshotsForPublicSite } from "../../../lib/surface-read";
import SiteTournamentsDistanceShell, { type SiteTournamentListRow } from "./SiteTournamentsDistanceShell";
import { parseTournamentStatusFilter } from "./tournament-list-url";
import SiteListPageSkeleton from "../components/SiteListPageSkeleton";

export const dynamic = "force-dynamic";

export default function SiteTournamentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<SiteListPageSkeleton brandTitle="대회안내" auxiliaryLabel="대회 목록을 불러오는 중입니다." listRows={4} />}>
      <SiteTournamentsPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SiteTournamentsPageContent({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const statusFilter = parseTournamentStatusFilter(resolvedSearchParams.status);

  const snapshots = await listSitePublicTournamentListSnapshotsForPublicSite();

  let ordered = snapshots.filter((s) => !SITE_TOURNAMENT_LIST_EXCLUDED_BADGES.has(s.statusBadge));
  if (statusFilter !== "all") {
    ordered = ordered.filter((s) => s.statusBadge === statusFilter);
  }

  ordered.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

  const rows: SiteTournamentListRow[] = ordered.map((s) => ({
    id: s.tournamentId,
    statusBadge: s.statusBadge,
    title: s.title,
    scheduleLine: s.dateLabel,
    locationLine: s.venueName,
    bracketParen: s.playScaleLabel.trim() ? s.playScaleLabel : null,
    posterSrc: s.thumbnail160Url,
  }));

  return <SiteTournamentsDistanceShell rows={rows} searchParams={resolvedSearchParams} currentStatus={statusFilter} />;
}
