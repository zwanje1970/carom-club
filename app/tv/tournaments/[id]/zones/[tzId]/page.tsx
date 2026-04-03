import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TvBracketScreen } from "@/components/tv/TvBracketScreen";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { canViewTournament } from "@/lib/permissions";
import { canManageTournamentZone } from "@/lib/auth-zone";

export default async function TvTournamentZonePage({
  params,
}: {
  params: Promise<{ id: string; tzId: string }>;
}) {
  const session = await getSession();
  const { id: tournamentId, tzId } = await params;
  if (!session) redirect(`/login?next=${encodeURIComponent(`/tv/tournaments/${tournamentId}/zones/${tzId}`)}`);

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) notFound();

  const allowed =
    session.role === "ZONE_MANAGER"
      ? await canManageTournamentZone(session, tzId)
      : canViewTournament(session, tournament, tournament.organization);
  if (!allowed) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col gap-6 px-5 py-5 md:px-8 md:py-8">
      <TvBracketScreen endpoint={`/api/tv/tournaments/${tournamentId}/zones/${tzId}`} />
    </main>
  );
}
