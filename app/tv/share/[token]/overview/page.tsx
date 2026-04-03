import { notFound } from "next/navigation";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { TvOverviewScreen } from "@/components/tv/TvOverviewScreen";

export default async function TvShareOverviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) notFound();

  return <TvOverviewScreen endpoint={`/api/tv/share/${token}/overview`} />;
}
