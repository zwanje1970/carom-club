import { notFound } from "next/navigation";
import { findTournamentByTvAccessToken } from "@/lib/tv-access";
import { TvBracketScreen } from "@/components/tv/TvBracketScreen";

export default async function TvShareZonePage({
  params,
}: {
  params: Promise<{ token: string; tzId: string }>;
}) {
  const { token, tzId } = await params;
  const tournament = await findTournamentByTvAccessToken(token);
  if (!tournament) notFound();

  return <TvBracketScreen endpoint={`/api/tv/share/${token}/zones/${tzId}`} />;
}
