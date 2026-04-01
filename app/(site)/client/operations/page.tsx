import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { canAccessClientDashboard } from "@/types/auth";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui/ConsoleTable";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { OperationsQuickActions } from "@/components/client/console/OperationsQuickActions";
import { OperationsTournamentMobileCard } from "@/components/client/console/OperationsTournamentMobileCard";
import { OperationsTournamentListRowActions } from "@/components/client/console/OperationsTournamentListRowActions";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { fillAdminCopyTemplate, getClientOperationsTournamentStatus, getCopyValue } from "@/lib/admin-copy";

export const metadata = {
  title: "대회 운영",
};

export default async function ClientOperationsPage() {
  const copy = await getAdminCopy();
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <ConsolePageHeader
          title={getCopyValue(copy, "client.operations.pageTitle")}
          description={getCopyValue(copy, "client.operations.participants.descriptionNoOrg")}
        />
        <Link
          href="/client/setup"
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-xs font-medium dark:border-zinc-600"
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
      endAt: true,
      status: true,
      venue: true,
      entryFee: true,
      maxParticipants: true,
      _count: { select: { entries: true } },
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

  const firstId = tournaments[0]?.id ?? null;

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow={getCopyValue(copy, "client.operations.eyebrow")}
        title={getCopyValue(copy, "client.operations.pageTitle")}
        description={fillAdminCopyTemplate(getCopyValue(copy, "client.operations.pageDescriptionWithOrg"), {
          orgName: org?.name ?? "—",
        })}
        actions={
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/client/operations/push"
              className="min-h-[44px] items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 inline-flex"
            >
              {getCopyValue(copy, "client.operations.linkPush")}
            </Link>
            <Link
              href="/client/operations/tournaments/new"
              className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-3 text-xs font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {getCopyValue(copy, "client.operations.linkNewTournament")}
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 md:hidden">
        <Link
          href="/client/operations/push"
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-300 px-3 text-center text-xs font-medium text-zinc-800 touch-manipulation hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          {getCopyValue(copy, "client.operations.linkPush")}
        </Link>
        <Link
          href="/client/operations/tournaments/new"
          className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800 px-3 text-center text-xs font-medium text-white touch-manipulation hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {getCopyValue(copy, "client.operations.linkNewTournament")}
        </Link>
      </div>

      <OperationsQuickActions firstTournamentId={firstId} copy={copy} />

      <ConsoleSection title={getCopyValue(copy, "client.operations.sectionTournaments")} flush>
        {tournaments.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{getCopyValue(copy, "client.operations.emptyTournaments")}</p>
        ) : (
          <>
            <div className="hidden md:block">
              <ConsoleTable>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>{getCopyValue(copy, "client.operations.thName")}</ConsoleTableTh>
                    <ConsoleTableTh>{getCopyValue(copy, "client.operations.thSchedule")}</ConsoleTableTh>
                    <ConsoleTableTh>{getCopyValue(copy, "admin.list.thVenue")}</ConsoleTableTh>
                    <ConsoleTableTh>{getCopyValue(copy, "client.operations.thEntryFee")}</ConsoleTableTh>
                    <ConsoleTableTh>{getCopyValue(copy, "client.operations.thApplications")}</ConsoleTableTh>
                    <ConsoleTableTh>{getCopyValue(copy, "admin.list.thStatus")}</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">{getCopyValue(copy, "admin.list.thActions")}</ConsoleTableTh>
                  </ConsoleTableRow>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {tournaments.map((t) => {
                    const confirmed = countMap[t.id] ?? 0;
                    const max = t.maxParticipants;
                    return (
                      <ConsoleTableRow key={t.id}>
                        <ConsoleTableTd className="max-w-[12rem] font-medium">
                          <span className="line-clamp-2">{t.name}</span>
                        </ConsoleTableTd>
                        <ConsoleTableTd className="whitespace-nowrap">
                          {formatKoreanDateWithWeekday(t.startAt)}
                        </ConsoleTableTd>
                        <ConsoleTableTd className="max-w-[10rem]">
                          <span className="line-clamp-2 text-zinc-600 dark:text-zinc-400">
                            {t.venue?.trim() || getCopyValue(copy, "admin.list.emptyDash")}
                          </span>
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          {t.entryFee != null
                            ? fillAdminCopyTemplate(getCopyValue(copy, "client.operations.format.entryFee"), {
                                amount: Number(t.entryFee).toLocaleString(),
                              })
                            : getCopyValue(copy, "admin.list.emptyDash")}
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          {fillAdminCopyTemplate(getCopyValue(copy, "client.operations.format.applicationsCell"), {
                            confirmed,
                            maxSuffix: max != null && max > 0 ? ` / ${max}` : "",
                          })}
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          <ConsoleBadge tone="neutral">{getClientOperationsTournamentStatus(copy, t.status)}</ConsoleBadge>
                        </ConsoleTableTd>
                        <ConsoleTableTd className="text-right">
                          <OperationsTournamentListRowActions tournamentId={t.id} copy={copy} />
                        </ConsoleTableTd>
                      </ConsoleTableRow>
                    );
                  })}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>

            <div className="flex flex-col gap-3 md:hidden">
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
      </ConsoleSection>
    </div>
  );
}
