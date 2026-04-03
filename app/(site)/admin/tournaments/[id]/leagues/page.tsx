import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { canManageTournament } from "@/lib/permissions";
import { ORGANIZATION_SELECT_ADMIN_BASIC } from "@/lib/db-selects";
import { getLeagueDetail } from "@/lib/league-service";
import { LeagueAdminConsole } from "@/components/league/LeagueAdminConsole";
import { serializeLeagueDetail, serializeLeagueSummary } from "@/lib/league-view";

export default async function AdminTournamentLeaguesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organization: { select: ORGANIZATION_SELECT_ADMIN_BASIC },
    },
  });
  if (!tournament) notFound();

  const session = await getSession();
  if (!session || !canManageTournament(session, tournament, tournament.organization)) {
    notFound();
  }

  const [leagueSummaries, zones, firstLeague] = await Promise.all([
    prisma.league.findMany({
      where: { tournamentId },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      include: { _count: { select: { entries: true, rounds: true, matches: true, standings: true } } },
    }),
    prisma.tournamentZone.findMany({
      where: { tournamentId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.league.findFirst({ where: { tournamentId }, orderBy: [{ kind: "asc" }, { createdAt: "asc" }], select: { id: true } }),
  ]);

  const initialLeague = firstLeague ? await getLeagueDetail(firstLeague.id) : null;

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href={`/admin/tournaments/${tournamentId}`} className="text-sm text-gray-500 hover:text-gray-700">
            ← 대회 상세
          </Link>
        </div>
        <LeagueAdminConsole
          tournamentId={tournamentId}
          initialLeagues={leagueSummaries.map(serializeLeagueSummary)}
          zones={zones.map((zone) => ({
            id: zone.id,
            name: zone.name ?? zone.code ?? zone.id,
            code: zone.code,
          }))}
          initialLeague={initialLeague ? serializeLeagueDetail(initialLeague) : null}
        />
      </div>
    </main>
  );
}
