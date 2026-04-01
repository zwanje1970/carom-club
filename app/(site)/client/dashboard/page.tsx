import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { prisma } from "@/lib/db";
import { normalizeSlug } from "@/lib/normalize-slug";
import { ClientLoginWelcomeBanner } from "@/components/client/ClientLoginWelcomeBanner";
import { loadClientOperationsDashboard } from "@/lib/client-operations-dashboard";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui/ConsoleTable";
import { formatKoreanDateTime } from "@/lib/format-date";
import { cx } from "@/components/client/console/ui/cx";
import { consoleTextMuted } from "@/components/client/console/ui/tokens";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

function tournamentStatusLabel(c: Record<AdminCopyKey, string>, code: string): string {
  const m: Partial<Record<string, AdminCopyKey>> = {
    DRAFT: "client.dashboard.tournamentStatus.DRAFT",
    OPEN: "client.dashboard.tournamentStatus.OPEN",
    CLOSED: "client.dashboard.tournamentStatus.CLOSED",
    BRACKET_GENERATED: "client.dashboard.tournamentStatus.BRACKET_GENERATED",
    FINISHED: "client.dashboard.tournamentStatus.FINISHED",
    HIDDEN: "client.dashboard.tournamentStatus.HIDDEN",
  };
  const k = m[code];
  return k ? getCopyValue(c, k) : code;
}

function matchStatusLabel(c: Record<AdminCopyKey, string>, code: string): string {
  const m: Partial<Record<string, AdminCopyKey>> = {
    PENDING: "client.dashboard.matchStatus.PENDING",
    READY: "client.dashboard.matchStatus.READY",
    BYE: "client.dashboard.matchStatus.BYE",
    IN_PROGRESS: "client.dashboard.matchStatus.IN_PROGRESS",
    COMPLETED: "client.dashboard.matchStatus.COMPLETED",
  };
  const k = m[code];
  return k ? getCopyValue(c, k) : code;
}

export const metadata = {
  title: "운영 대시보드",
};

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const copy = await getAdminCopy();
  const c = copy as Record<AdminCopyKey, string>;
  const params = await searchParams;
  const welcome = params.welcome;
  const annualMembershipVisible = await isAnnualMembershipVisible();

  const orgId = await getClientAdminOrganizationId(session);
  let org: {
    name: string;
    slug: string;
    setupCompleted: boolean;
    approvalStatus: string | null;
    clientType: string | null;
    membershipType: string | null;
  } | null = null;

  if (orgId) {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        slug: true,
        setupCompleted: true,
        approvalStatus: true,
        clientType: true,
        membershipType: true,
      },
    });
    if (row) {
      org = normalizeSlug(row);
      if (!row.setupCompleted) {
        redirect("/client/setup");
      }
    }
  }

  const dash = orgId ? await loadClientOperationsDashboard(orgId) : null;

  return (
    <div className="space-y-6 md:space-y-5">
      <ClientLoginWelcomeBanner show={welcome === "1"} />

      <ConsolePageHeader
        eyebrow={getCopyValue(c, "client.dashboard.home.eyebrow")}
        title={getCopyValue(c, "client.dashboard.home.pageHeaderTitle")}
        description={
          org
            ? getCopyValue(c, "client.dashboard.home.descriptionWithOrg").replace("{name}", org.name)
            : getCopyValue(c, "client.dashboard.home.descriptionNoOrg")
        }
      />

      {!org ? (
        <section className="border border-amber-400 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">{getCopyValue(c, "client.dashboard.home.noOrgTitle")}</p>
          <p className="mt-1">
            {getCopyValue(c, "client.dashboard.home.noOrgLine2Prefix")}
            <Link href="/mypage" className="font-medium underline">
              {getCopyValue(c, "client.dashboard.home.noOrgMypageLink")}
            </Link>
            {getCopyValue(c, "client.dashboard.home.noOrgLine2Suffix")}
          </p>
        </section>
      ) : (
        <>
          {/* 운영 현황 요약 */}
          <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionOpsSummary")} flush>
            <div className="md:hidden space-y-3 p-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{getCopyValue(c, "client.dashboard.home.metricActiveTournaments")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{dash?.stats.activeTournaments ?? 0}</p>
                <Link href="/client/operations" className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-indigo-800 touch-manipulation dark:border-zinc-600 dark:bg-zinc-800 dark:text-indigo-300">
                  {getCopyValue(c, "client.dashboard.home.linkTournamentOps")}
                </Link>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{getCopyValue(c, "client.dashboard.home.metricPendingApprovals")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{dash?.stats.pendingEntryApprovals ?? 0}</p>
                <Link href="/client/operations" className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-indigo-800 touch-manipulation dark:border-zinc-600 dark:bg-zinc-800 dark:text-indigo-300">
                  {getCopyValue(c, "client.dashboard.home.linkTournamentOps")}
                </Link>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{getCopyValue(c, "client.dashboard.home.metricBracketIncomplete")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{dash?.stats.bracketIncompleteLocked ?? 0}</p>
                <Link href="/client/operations" className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-indigo-800 touch-manipulation dark:border-zinc-600 dark:bg-zinc-800 dark:text-indigo-300">
                  {getCopyValue(c, "client.dashboard.home.linkBracketConsole")}
                </Link>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{getCopyValue(c, "client.dashboard.home.metricSettlementPending")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{dash?.stats.settlementPendingFinished ?? 0}</p>
                <Link href="/client/billing" className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-indigo-800 touch-manipulation dark:border-zinc-600 dark:bg-zinc-800 dark:text-indigo-300">
                  {getCopyValue(c, "client.dashboard.home.linkSettlement")}
                </Link>
              </div>
            </div>
            <div className="hidden md:block">
              <ConsoleTable>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>{getCopyValue(c, "client.dashboard.home.thMetric")}</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">{getCopyValue(c, "client.dashboard.home.thValue")}</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">{getCopyValue(c, "client.dashboard.home.thGo")}</ConsoleTableTh>
                  </ConsoleTableRow>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  <ConsoleTableRow>
                    <ConsoleTableTd>{getCopyValue(c, "client.dashboard.home.metricActiveTournaments")}</ConsoleTableTd>
                    <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                      {dash?.stats.activeTournaments ?? 0}
                    </ConsoleTableTd>
                    <ConsoleTableTd className="text-right">
                      <Link
                        href="/client/operations"
                        className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                      >
                        {getCopyValue(c, "client.dashboard.home.linkTournamentOps")}
                      </Link>
                    </ConsoleTableTd>
                  </ConsoleTableRow>
                  <ConsoleTableRow>
                    <ConsoleTableTd>{getCopyValue(c, "client.dashboard.home.metricPendingApprovals")}</ConsoleTableTd>
                    <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                      {dash?.stats.pendingEntryApprovals ?? 0}
                    </ConsoleTableTd>
                    <ConsoleTableTd className="text-right">
                      <Link
                        href="/client/operations"
                        className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                      >
                        {getCopyValue(c, "client.dashboard.home.linkTournamentOps")}
                      </Link>
                    </ConsoleTableTd>
                  </ConsoleTableRow>
                  <ConsoleTableRow>
                    <ConsoleTableTd>{getCopyValue(c, "client.dashboard.home.metricBracketIncomplete")}</ConsoleTableTd>
                    <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                      {dash?.stats.bracketIncompleteLocked ?? 0}
                    </ConsoleTableTd>
                    <ConsoleTableTd className="text-right">
                      <Link
                        href="/client/operations"
                        className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                      >
                        {getCopyValue(c, "client.dashboard.home.linkBracketConsole")}
                      </Link>
                    </ConsoleTableTd>
                  </ConsoleTableRow>
                  <ConsoleTableRow>
                    <ConsoleTableTd>{getCopyValue(c, "client.dashboard.home.metricSettlementPending")}</ConsoleTableTd>
                    <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                      {dash?.stats.settlementPendingFinished ?? 0}
                    </ConsoleTableTd>
                    <ConsoleTableTd className="text-right">
                      <Link
                        href="/client/billing"
                        className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                      >
                        {getCopyValue(c, "client.dashboard.home.linkSettlement")}
                      </Link>
                    </ConsoleTableTd>
                  </ConsoleTableRow>
                </ConsoleTableBody>
              </ConsoleTable>
            </div>
          </ConsoleSection>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-4">
            <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionToday")} flush>
              {dash && dash.todayTournaments.length === 0 && dash.todayMatches.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">{getCopyValue(c, "client.dashboard.home.todayEmpty")}</p>
              ) : (
                <>
                  {dash && dash.todayTournaments.length > 0 && (
                    <div className="border-b border-zinc-200 px-2 py-1.5 text-[10px] font-semibold uppercase text-zinc-500 dark:border-zinc-700">
                      {getCopyValue(c, "client.dashboard.home.todayTournamentsHeader")}
                    </div>
                  )}
                  {dash?.todayTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-2 py-1.5 text-[11px] dark:border-zinc-800"
                    >
                      <span className="min-w-0 max-w-full break-words font-medium">{t.name}</span>
                      <span className="text-zinc-500">{tournamentStatusLabel(c, t.status)}</span>
                      <Link href={`/client/operations/tournaments/${t.id}/bracket`} className="text-indigo-800 underline dark:text-indigo-300">
                        {getCopyValue(c, "client.dashboard.home.linkBracket")}
                      </Link>
                    </div>
                  ))}
                  {dash && dash.todayMatches.length > 0 && (
                    <div className="border-b border-zinc-200 px-2 py-1.5 text-[10px] font-semibold uppercase text-zinc-500 dark:border-zinc-700">
                      {getCopyValue(c, "client.dashboard.home.todayMatchesHeader")}
                    </div>
                  )}
                  {dash?.todayMatches.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-2 py-1.5 text-[11px] dark:border-zinc-800"
                    >
                      <span>
                        {m.tournamentName} · {m.roundIndex + 1}R #{m.matchIndex + 1}
                      </span>
                      <span className="font-mono text-zinc-600">{matchStatusLabel(c, m.status)}</span>
                      <span className="text-zinc-500">
                        {m.scheduledStartAt ? formatKoreanDateTime(m.scheduledStartAt) : getCopyValue(c, "client.dashboard.home.matchTimeTbd")}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </ConsoleSection>

            <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionPending")} flush>
              {dash && dash.pendingTasks.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">{getCopyValue(c, "client.dashboard.home.pendingEmpty")}</p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {dash?.pendingTasks.map((t) => (
                    <li key={t.kind} className="flex items-center justify-between gap-2 px-2 py-2 text-[11px]">
                      <span>
                        {t.label}
                        {t.count != null ? (
                          <span className="ml-1 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                            {t.count}
                          </span>
                        ) : null}
                      </span>
                      <Link href={t.href} className="shrink-0 font-medium text-indigo-800 underline dark:text-indigo-300">
                        {getCopyValue(c, "client.dashboard.home.pendingAction")}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ConsoleSection>
          </div>

          <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionQuick")} plain>
            <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:gap-2 md:text-[11px]">
              <Link
                href="/client/operations/tournaments/new"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-800 bg-zinc-800 px-3 py-2 text-center text-xs font-medium text-white touch-manipulation dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickNewTournament")}
              </Link>
              <Link
                href="/client/operations"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-400 px-3 py-2 text-center text-xs font-medium touch-manipulation hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickApprove")}
              </Link>
              <Link
                href="/client/operations"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-400 px-3 py-2 text-center text-xs font-medium touch-manipulation hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickTournamentOps")}
              </Link>
              <Link
                href="/client/operations"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-400 px-3 py-2 text-center text-xs font-medium touch-manipulation hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickBracket")}
              </Link>
              <Link
                href="/client/billing"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-400 px-3 py-2 text-center text-xs font-medium touch-manipulation hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickSettlement")}
              </Link>
              <Link
                href="/client/promo"
                className="inline-flex min-h-[48px] items-center justify-center rounded-lg border border-zinc-400 px-3 py-2 text-center text-xs font-medium touch-manipulation hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800 md:min-h-0 md:rounded-sm md:px-2.5 md:py-1.5"
              >
                {getCopyValue(c, "client.dashboard.home.quickPromo")}
              </Link>
            </div>
          </ConsoleSection>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-4">
            <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionRecent")} flush>
              <div className="border-b border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700">
                {getCopyValue(c, "client.dashboard.home.recentTournamentsHeader")}
              </div>
              {dash && dash.recentTournaments.length === 0 ? (
                <p className="p-2 text-[11px] text-zinc-500">{getCopyValue(c, "client.dashboard.home.recentEmpty")}</p>
              ) : (
                <>
                  <div className="md:hidden divide-y divide-zinc-200 dark:divide-zinc-700">
                    {dash?.recentTournaments.map((t) => (
                      <div key={t.id} className="flex flex-col gap-2 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <span className="min-w-0 flex-1 font-medium leading-snug text-zinc-900 dark:text-zinc-100">{t.name}</span>
                          <span className="shrink-0 rounded-md border border-zinc-300 bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                            {tournamentStatusLabel(c, t.status)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">{formatKoreanDateTime(t.updatedAt)}</p>
                        <Link
                          href={`/client/tournaments/${t.id}`}
                          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-300 bg-zinc-50 text-sm font-medium text-indigo-800 touch-manipulation dark:border-zinc-600 dark:bg-zinc-800 dark:text-indigo-300"
                        >
                          {getCopyValue(c, "client.dashboard.home.open")}
                        </Link>
                      </div>
                    ))}
                  </div>
                  <div className="hidden md:block">
                    <ConsoleTable>
                      <ConsoleTableHead>
                        <ConsoleTableRow>
                          <ConsoleTableTh>{getCopyValue(c, "client.dashboard.home.thTournament")}</ConsoleTableTh>
                          <ConsoleTableTh>{getCopyValue(c, "admin.list.thStatus")}</ConsoleTableTh>
                          <ConsoleTableTh>{getCopyValue(c, "client.dashboard.home.thUpdated")}</ConsoleTableTh>
                          <ConsoleTableTh className="text-right"> </ConsoleTableTh>
                        </ConsoleTableRow>
                      </ConsoleTableHead>
                      <ConsoleTableBody>
                        {dash?.recentTournaments.map((t) => (
                          <ConsoleTableRow key={t.id}>
                            <ConsoleTableTd className="max-w-[10rem]">
                              <span className="line-clamp-2 font-medium">{t.name}</span>
                            </ConsoleTableTd>
                            <ConsoleTableTd className="whitespace-nowrap text-zinc-500">
                              {tournamentStatusLabel(c, t.status)}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="whitespace-nowrap text-zinc-500">
                              {formatKoreanDateTime(t.updatedAt)}
                            </ConsoleTableTd>
                            <ConsoleTableTd className="text-right">
                              <Link
                                href={`/client/tournaments/${t.id}`}
                                className="text-[10px] text-indigo-800 underline dark:text-indigo-300"
                              >
                                {getCopyValue(c, "client.dashboard.home.open")}
                              </Link>
                            </ConsoleTableTd>
                          </ConsoleTableRow>
                        ))}
                      </ConsoleTableBody>
                    </ConsoleTable>
                  </div>
                </>
              )}
              <div className="border-b border-t border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700">
                {getCopyValue(c, "client.dashboard.home.auditHeader")}
              </div>
              {dash && dash.recentAudit.length === 0 ? (
                <p className="p-2 text-[11px] text-zinc-500">{getCopyValue(c, "client.dashboard.home.auditEmpty")}</p>
              ) : (
                <ul className="max-h-48 overflow-y-auto text-[10px]">
                  {dash?.recentAudit.map((a, i) => (
                    <li
                      key={`${a.matchId}-${i}`}
                      className="border-b border-zinc-100 px-2 py-1 font-mono text-zinc-700 dark:border-zinc-800 dark:text-zinc-300"
                    >
                      <span className="text-zinc-500">{formatKoreanDateTime(a.at)}</span> · {a.tournamentName} ·{" "}
                      {a.action} · {a.matchId.slice(0, 8)}…
                    </li>
                  ))}
                </ul>
              )}
            </ConsoleSection>

            <ConsoleSection title={getCopyValue(c, "client.dashboard.home.sectionAlerts")} flush>
              {dash && dash.alerts.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">{getCopyValue(c, "client.dashboard.home.alertsEmpty")}</p>
              ) : (
                <ul className="space-y-2 p-2">
                  {dash?.alerts.map((a, i) => (
                    <li
                      key={i}
                      className={cx(
                        "border-l-2 px-2 py-1 text-[11px]",
                        a.level === "warn"
                          ? "border-amber-500 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
                          : "border-zinc-400 bg-zinc-50 text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-200"
                      )}
                    >
                      {a.text}
                    </li>
                  ))}
                </ul>
              )}
              <p className={cx("border-t border-zinc-200 px-2 py-2 text-[10px] dark:border-zinc-700", consoleTextMuted)}>
                {getCopyValue(c, "client.dashboard.home.orgLabelPrefix")}{" "}
                {org.approvalStatus === "APPROVED"
                  ? org.clientType === "REGISTERED"
                    ? annualMembershipVisible
                      ? getCopyValue(c, "client.dashboard.home.orgRegisteredAnnual")
                      : getCopyValue(c, "client.dashboard.home.orgRegistered")
                    : getCopyValue(c, "client.dashboard.home.orgGeneral")
                  : getCopyValue(c, "client.dashboard.home.orgPendingApproval")}
              </p>
            </ConsoleSection>
          </div>

          <p className={cx("text-[10px]", consoleTextMuted)}>
            {getCopyValue(c, "client.dashboard.consoleTitle")}
            {getCopyValue(c, "client.dashboard.home.footerHelpMid")}
            <Link href="/client/promo" className="underline">
              {getCopyValue(c, "client.dashboard.home.footerHelpPromo")}
            </Link>
            {getCopyValue(c, "client.dashboard.home.footerHelpSep")}
            <Link href="/client/settings" className="underline">
              {getCopyValue(c, "client.dashboard.home.footerHelpSettings")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
