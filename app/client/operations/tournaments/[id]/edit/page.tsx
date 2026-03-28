import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";
import { OperationsTournamentEditPageClient } from "./OperationsTournamentEditPageClient";

export const metadata = { title: "대회 수정" };

export default async function ClientOperationsTournamentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const { id } = await params;

  const [org, tournament] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    }),
    prisma.tournament.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true },
    }),
  ]);

  if (!tournament) notFound();

  return (
    <OperationsTournamentEditPageClient
      tournamentId={id}
      organizationId={orgId}
      organizationName={org?.name ?? "—"}
    />
  );
}
