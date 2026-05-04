import { notFound } from "next/navigation";
import { TvTournamentBracketScreen } from "../../../../../components/tv/TvTournamentBracketScreen";
import { findTournamentZoneByTvAccessToken } from "../../../../../lib/server/firestore-tournament-zones";
import { getTournamentByIdFirestore } from "../../../../../lib/server/firestore-tournaments";

export const dynamic = "force-dynamic";

export default async function TvShareZoneBracketPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) notFound();

  const zone = await findTournamentZoneByTvAccessToken(token);
  if (!zone) notFound();

  const tournament = await getTournamentByIdFirestore(zone.tournamentId);
  if (!tournament || tournament.status === "DELETED") notFound();

  return (
    <TvTournamentBracketScreen
      tournamentId={zone.tournamentId}
      zoneId={zone.id}
      shareZoneToken={token}
    />
  );
}
