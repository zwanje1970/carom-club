import { TvTournamentBracketScreen } from "../../../../components/tv/TvTournamentBracketScreen";

export default async function TvTournamentBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournamentId = typeof id === "string" ? id.trim() : "";
  return <TvTournamentBracketScreen tournamentId={tournamentId} />;
}
