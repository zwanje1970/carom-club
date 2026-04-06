import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { canAccessClientDashboard } from "@/types/auth";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { ClientOperationsParticipantsPanel } from "@/components/client/console/ClientOperationsParticipantsPanel";
import { toTournamentOperationPhaseSnapshot } from "@/lib/client-tournament-operation-phase";

export const metadata = { title: "참가자 관리" };

export default async function ClientTournamentParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const { id: tournamentId } = await params;

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { id: true, clientType: true, membershipType: true },
  });
  if (!org) notFound();

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, organizationId: orgId },
    select: {
      id: true,
      name: true,
      status: true,
      participantRosterLockedAt: true,
      _count: { select: { finalMatches: true } },
    },
  });
  if (!tournament) notFound();

  const canManage = await canUseFeature(org, FEATURE_CODES.PARTICIPANT_MANAGEMENT);
  if (!canManage) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <div className="space-y-4">
        <FeatureGateNotice
          featureName="참가자 관리"
          clientType={org.clientType}
          membershipType={org.membershipType}
          annualActive={annualActive}
        />
      </div>
    );
  }

  return (
    <ClientOperationsParticipantsPanel
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      listHref={`/client/tournaments/${tournament.id}`}
      operationPhase={{
        snapshot: toTournamentOperationPhaseSnapshot(tournament),
        currentView: "participants",
      }}
    />
  );
}
