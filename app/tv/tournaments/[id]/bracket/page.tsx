import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TvBracketScreen } from "@/components/tv/TvBracketScreen";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament } from "@/lib/permissions";

export default async function TvTournamentBracketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: tournamentId } = await params;
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/tv/tournaments/${tournamentId}/bracket`)}`);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) notFound();
  if (!canViewTournament(session, tournament, tournament.organization)) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-6 px-5 py-5 md:px-8 md:py-8">
      <TvBracketScreen endpoint={`/api/tv/tournaments/${tournamentId}/bracket`} />
    </main>
  );
}
