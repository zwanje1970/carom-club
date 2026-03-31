import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { canAccessClientDashboard } from "@/types/auth";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { ClientBracketEditor } from "@/components/client/console/ClientBracketEditor";
import { toTournamentOperationPhaseSnapshot } from "@/lib/client-tournament-operation-phase";

export const metadata = { title: "대진표 보기·수정" };

export default async function ClientOperationsBracketPage({
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

  const canBracket = await canUseFeature(org, FEATURE_CODES.BRACKET_SYSTEM);
  if (!canBracket) {
    const annualActive = await isAnnualMembershipActive(orgId);
    return (
      <FeatureGateNotice
        featureName="대진표 시스템"
        clientType={org.clientType}
        membershipType={org.membershipType}
        annualActive={annualActive}
      />
    );
  }

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

  return (
    <ClientBracketEditor
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      listHref="/client/operations"
      operationPhase={{
        snapshot: toTournamentOperationPhaseSnapshot(tournament),
        currentView: "bracket",
      }}
    />
  );
}
