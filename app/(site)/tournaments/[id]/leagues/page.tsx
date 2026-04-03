import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPublicTournamentOrNull } from "@/lib/public-tournament";
import { LeaguePublicBoard } from "@/components/league/LeaguePublicBoard";
import { getLeagueDetail } from "@/lib/league-service";
import { serializeLeagueDetail } from "@/lib/league-view";

export default async function PublicTournamentLeaguesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  const tournament = await getPublicTournamentOrNull(tournamentId);
  if (!tournament) notFound();
  const session = await getSession();

  const leagues = await prisma.league.findMany({
    where: { tournamentId },
    orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const leagueDetails = await Promise.all(
    leagues.map(async (league) => {
      const detail = await getLeagueDetail(league.id);
      return detail ? serializeLeagueDetail(detail) : null;
    })
  );

  const publicLeagues = leagueDetails.filter((league): league is NonNullable<typeof league> => league != null);
  const myTournamentEntryIds =
    session && publicLeagues.length > 0
      ? await prisma.tournamentEntry.findMany({
          where: { tournamentId, userId: session.id },
          select: { id: true },
        }).then((rows) => rows.map((row) => row.id))
      : [];

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <Link href={`/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
          ← 대회 상세
        </Link>
        <LeaguePublicBoard tournamentName={tournament.name} leagues={publicLeagues} myTournamentEntryIds={myTournamentEntryIds} />
      </div>
    </main>
  );
}
