import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { ClientZoneBracketClient } from "@/components/client/ClientZoneBracketClient";
import { canAccessClientDashboard } from "@/types/auth";

export default async function ClientTournamentZoneBracketPage({
  params,
}: {
  params: Promise<{ id: string; tzId: string }>;
}) {
  const { id: tournamentId, tzId } = await params;
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) notFound();

  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, organizationId: orgId },
    select: { id: true, name: true },
  });
  if (!tournament) notFound();

  const tz = await prisma.tournamentZone.findFirst({
    where: { id: tzId, tournamentId },
    include: { zone: { select: { name: true, code: true } } },
  });
  if (!tz) notFound();

  const base = `/client/tournaments/${tournamentId}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`${base}/zones`} className="rounded-lg border border-site-border px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-800">
          ← 부/권역
        </Link>
      </div>
      <h2 className="text-lg font-semibold text-site-text">
        {tz.name ?? tz.zone.name} 대진표
      </h2>
      <ClientZoneBracketClient tournamentId={tournamentId} tzId={tzId} allowEdit={false} />
    </div>
  );
}
