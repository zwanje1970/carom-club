import { notFound } from "next/navigation";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { TvBracketScreen } from "@/components/tv/TvBracketScreen";

export default async function TvShareBracketPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) notFound();

  return <TvBracketScreen endpoint={`/api/tv/share/${token}/bracket`} />;
}
