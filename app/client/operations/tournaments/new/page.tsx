import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { canAccessClientDashboard } from "@/types/auth";
import { OperationsTournamentEditorClient } from "@/components/client/OperationsTournamentEditorClient";

export const metadata = { title: "대회 등록" };

export default async function ClientOperationsTournamentNewPage() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  return (
    <OperationsTournamentEditorClient
      mode="create"
      organizationId={orgId}
      organizationName={org?.name ?? "—"}
    />
  );
}
