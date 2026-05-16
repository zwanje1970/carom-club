"use client";

import dynamic from "next/dynamic";

const SiteTournamentBracketEmbed = dynamic(() => import("./site-tournament-bracket-embed"), {
  ssr: false,
  loading: () => <p className="v3-muted" style={{ margin: "0.5rem 0" }}>대진표 불러오는 중…</p>,
});

export default function SiteTournamentBracketEmbedDynamic(props: {
  tournamentId: string;
  fastPoll: boolean;
  statusBadge?: string;
  schedule?: { date?: string; eventDates?: string[] | null };
}) {
  return <SiteTournamentBracketEmbed {...props} />;
}
