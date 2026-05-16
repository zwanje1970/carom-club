"use client";

import dynamic from "next/dynamic";

const TournamentDetailedResultsFetchClient = dynamic(
  () => import("../../../components/TournamentDetailedResultsFetchClient"),
  {
    ssr: false,
    loading: () => <p className="v3-muted" style={{ margin: "0.5rem 0" }}>대회결과 불러오는 중…</p>,
  },
);

export default function SiteTournamentDetailResultsEmbedDynamic({ tournamentId }: { tournamentId: string }) {
  const fetchUrl = `/api/site/tournaments/${encodeURIComponent(tournamentId)}/detailed-results`;
  const backHref = `/site/tournaments/${encodeURIComponent(tournamentId)}`;
  return (
    <TournamentDetailedResultsFetchClient
      fetchUrl={fetchUrl}
      backHref={backHref}
      backLabel="대회 상세로"
      embedded
    />
  );
}
