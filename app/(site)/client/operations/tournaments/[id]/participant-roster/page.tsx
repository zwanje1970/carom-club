import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";
import { ClientOperationsParticipantRosterPanel } from "@/components/client/console/ClientOperationsParticipantRosterPanel";
import { toTournamentOperationPhaseSnapshot } from "@/lib/client-tournament-operation-phase";

export const metadata = { title: "참가 명단 확정" };

export default async function ClientOperationsParticipantRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const { id: tournamentId } = await params;

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, organizationId: orgId },
    select: {
      id: true,
      status: true,
      participantRosterLockedAt: true,
      _count: { select: { finalMatches: true } },
    },
  });
  if (!tournament) notFound();

  return (
    <ClientOperationsParticipantRosterPanel
      tournamentId={tournament.id}
      listHref="/client/operations"
      operationPhase={{
        snapshot: toTournamentOperationPhaseSnapshot(tournament),
        currentView: "roster",
      }}
    />
  );
}
