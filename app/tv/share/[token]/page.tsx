import { notFound } from "next/navigation";
import { TvTournamentBracketScreen } from "../../../../components/tv/TvTournamentBracketScreen";
import { findTournamentIdByTvAccessTokenFirestore } from "../../../../lib/server/firestore-tournaments";

export const dynamic = "force-dynamic";

export default async function TvShareBracketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) notFound();

  const tournamentId = await findTournamentIdByTvAccessTokenFirestore(token);
  if (!tournamentId) notFound();

  return <TvTournamentBracketScreen tournamentId={tournamentId} shareToken={token} />;
}
