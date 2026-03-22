import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canUseFeature, FEATURE_CODES, isAnnualMembershipActive } from "@/lib/feature-access";
import { canAccessClientDashboard } from "@/types/auth";
import { FeatureGateNotice } from "@/components/client/FeatureGateNotice";
import { ClientBracketBuildConsole } from "@/components/client/console/ClientBracketBuildConsole";

export const metadata = { title: "대진 생성 콘솔" };

export default async function ClientOperationsBracketBuildPage({
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
    include: {
      rule: true,
      matchVenues: { orderBy: { sortOrder: "asc" } },
      _count: { select: { rounds: true } },
    },
  });
  if (!tournament) notFound();

  const confirmedCount = await prisma.tournamentEntry.count({
    where: { tournamentId, status: "CONFIRMED" },
  });

  const confirmedParticipants = await prisma.tournamentEntry.findMany({
    where: { tournamentId, status: "CONFIRMED" },
    select: { id: true, round: true },
    orderBy: { id: "asc" },
  });

  const rawConfig = tournament.rule?.bracketConfig;
  const config: Record<string, unknown> =
    typeof rawConfig === "string" ? (rawConfig ? JSON.parse(rawConfig) : {}) : (rawConfig ?? {});
  const defaultTableCount = (config.tableCount as number) ?? 6;
  const venueCountFromDb = Math.max(1, tournament.matchVenues.length || 1);

  return (
    <ClientBracketBuildConsole
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      tournamentStatus={tournament.status}
      participantRosterLockedAt={tournament.participantRosterLockedAt?.toISOString() ?? null}
      bracketAlreadyGenerated={tournament.status === "BRACKET_GENERATED" || tournament._count.rounds > 0}
      confirmedParticipantCount={confirmedCount}
      confirmedParticipants={confirmedParticipants.map((e) => ({
        entryId: e.id,
        divisionKey: e.round?.trim() ? e.round : "",
      }))}
      defaultVenueCount={venueCountFromDb}
      defaultTablesPerVenue={defaultTableCount}
      listHref="/client/operations"
      legacyBracketHref={`/client/tournaments/${tournament.id}/bracket`}
    />
  );
}
