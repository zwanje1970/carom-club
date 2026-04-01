import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { canAccessClientDashboard } from "@/types/auth";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { OperationsTournamentMobileCard } from "@/components/client/console/OperationsTournamentMobileCard";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { fillAdminCopyTemplate, getClientOperationsTournamentStatus, getCopyValue } from "@/lib/admin-copy";

export const metadata = { title: "참가 관리" };

export default async function ClientOperationsParticipantsHubPage() {
  const copy = await getAdminCopy();
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <ConsolePageHeader
          title={getCopyValue(copy, "client.operations.participants.title")}
          description={getCopyValue(copy, "client.operations.participants.descriptionNoOrg")}
        />
        <Link
          href="/client/setup"
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-sm font-medium"
        >
          {getCopyValue(copy, "client.operations.participants.setupCta")}
        </Link>
      </div>
    );
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: orgId },
    orderBy: { startAt: "desc" },
    select: {
      id: true,
      name: true,
      startAt: true,
      status: true,
      venue: true,
      maxParticipants: true,
    },
  });

  const ids = tournaments.map((t) => t.id);
  const confirmedByTournament =
    ids.length > 0
      ? await prisma.tournamentEntry.groupBy({
          by: ["tournamentId"],
          where: { tournamentId: { in: ids }, status: "CONFIRMED" },
          _count: { id: true },
        })
      : [];
  const countMap = Object.fromEntries(confirmedByTournament.map((r) => [r.tournamentId, r._count.id]));

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow={getCopyValue(copy, "client.operations.eyebrow")}
        title={getCopyValue(copy, "client.operations.participants.title")}
        description={fillAdminCopyTemplate(getCopyValue(copy, "client.operations.participants.descriptionWithOrg"), {
          orgName: org?.name ?? "—",
        })}
        actions={
          <Link
            href="/client/operations"
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-3 text-xs font-medium dark:border-zinc-600"
          >
            {getCopyValue(copy, "client.operations.participants.backToTournamentList")}
          </Link>
        }
      />

      {tournaments.length === 0 ? (
        <p className="text-sm text-zinc-500">{getCopyValue(copy, "client.operations.participants.emptyNoTournaments")}</p>
      ) : (
        <>
          <ul className="hidden lg:block lg:divide-y lg:divide-zinc-200 lg:rounded-lg lg:border lg:border-zinc-200 dark:lg:divide-zinc-700 dark:lg:border-zinc-700">
            {tournaments.map((t) => {
              const confirmed = countMap[t.id] ?? 0;
              const max = t.maxParticipants;
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{t.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {fillAdminCopyTemplate(getCopyValue(copy, "client.operations.tournamentRowMeta"), {
                        date: formatKoreanDateWithWeekday(t.startAt),
                        confirmed,
                        maxSuffix: max != null && max > 0 ? ` / ${max}` : "",
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <ConsoleBadge tone="neutral">{getClientOperationsTournamentStatus(copy, t.status)}</ConsoleBadge>
                    <Link
                      href={`/client/operations/tournaments/${t.id}/participants`}
                      className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-900 bg-zinc-900 px-3 text-xs font-semibold text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                    >
                      {getCopyValue(copy, "client.operations.participants.btnParticipantAdmin")}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-3 lg:hidden">
            {tournaments.map((t) => {
              const confirmed = countMap[t.id] ?? 0;
              const max = t.maxParticipants;
              return (
                <OperationsTournamentMobileCard
                  key={t.id}
                  copy={copy}
                  t={{
                    id: t.id,
                    name: t.name,
                    startAt: t.startAt,
                    status: t.status,
                    venue: t.venue,
                    confirmed,
                    max,
                  }}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
