import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { canAccessClientDashboard } from "@/types/auth";
import { getClientOrgTournamentMutationRole } from "@/lib/client-tournament-access";
import { ClientTournamentDeleteControl } from "@/components/client/console/ClientTournamentDeleteControl";
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

export const metadata = {
  title: "전체대회",
};

function statusLabel(status: string): "계획중" | "모집중" | "마감" | "종료" {
  if (status === "DRAFT" || status === "HIDDEN") return "계획중";
  if (status === "OPEN") return "모집중";
  if (status === "FINISHED") return "종료";
  return "마감";
}

function statusTone(status: string): string {
  if (status === "OPEN") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "FINISHED") return "border-zinc-300 bg-zinc-100 text-zinc-700";
  if (status === "DRAFT" || status === "HIDDEN") return "border-amber-300 bg-amber-50 text-amber-900";
  return "border-indigo-300 bg-indigo-50 text-indigo-900";
}

export default async function ClientTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) redirect("/client/setup");

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true },
  });

  const canMutate = (await getClientOrgTournamentMutationRole(session.id, orgId)) != null;

  const { tab } = await searchParams;
  const activeTab = tab === "progress" || tab === "finished" || tab === "planned" ? tab : "all";

  const whereByTab =
    activeTab === "progress"
      ? { status: { in: ["OPEN", "CLOSED", "BRACKET_GENERATED"] } }
      : activeTab === "finished"
        ? { status: "FINISHED" }
        : activeTab === "planned"
          ? { status: { in: ["DRAFT", "HIDDEN"] } }
          : {};

  const tournaments = await prisma.tournament.findMany({
    where: { organizationId: orgId, ...whereByTab },
    orderBy: [{ startAt: "desc" }],
    select: {
      id: true,
      name: true,
      startAt: true,
      status: true,
      maxParticipants: true,
      _count: { select: { entries: true } },
    },
  });

  const ids = tournaments.map((t) => t.id);
  const [approvedRows, pendingRows] =
    ids.length > 0
      ? await Promise.all([
          prisma.tournamentEntry.groupBy({
            by: ["tournamentId"],
            where: { tournamentId: { in: ids }, status: "CONFIRMED" },
            _count: { id: true },
          }),
          prisma.tournamentEntry.groupBy({
            by: ["tournamentId"],
            where: { tournamentId: { in: ids }, status: "APPLIED" },
            _count: { id: true },
          }),
        ])
      : [[], []];
  const approvedMap = Object.fromEntries(approvedRows.map((r) => [r.tournamentId, r._count.id]));
  const pendingMap = Object.fromEntries(pendingRows.map((r) => [r.tournamentId, r._count.id]));

  const tabs = [
    { id: "all", label: "전체" },
    { id: "progress", label: "진행" },
    { id: "finished", label: "종료" },
    { id: "planned", label: "계획중" },
  ] as const;

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="운영"
        title="전체대회"
        description={org ? `「${org.name}」 대회 목록 및 기록` : "대회 목록 및 기록"}
        actions={
          <Link
            href="/client/tournaments/new"
            className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-3 text-xs font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            대회 생성
          </Link>
        }
      />

      <ConsoleSection title="필터" plain>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.id === "all" ? "/client/tournaments" : `/client/tournaments?tab=${t.id}`}
              className={
                activeTab === t.id
                  ? "inline-flex min-h-[40px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-3 text-xs font-semibold text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
                  : "inline-flex min-h-[40px] items-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }
            >
              {t.label}
            </Link>
          ))}
        </div>
      </ConsoleSection>

      <ConsoleSection title="대회 목록" flush>
        {tournaments.length === 0 ? (
          <p className="p-3 text-xs text-zinc-500 dark:text-zinc-400">조건에 맞는 대회가 없습니다.</p>
        ) : (
          <>
            <div className="hidden md:block">
              <ConsoleTable>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>대회명</ConsoleTableTh>
                    <ConsoleTableTh>일정</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">신청자</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">승인</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">미승인</ConsoleTableTh>
                    <ConsoleTableTh>상태</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">관리</ConsoleTableTh>
                  </ConsoleTableRow>
                </ConsoleTableHead>
                <ConsoleTableBody>
                  {tournaments.map((t) => (
                    <ConsoleTableRow key={t.id}>
                      <ConsoleTableTd className="font-medium">{t.name}</ConsoleTableTd>
                      <ConsoleTableTd>{formatKoreanDateWithWeekday(t.startAt)}</ConsoleTableTd>
                      <ConsoleTableTd className="text-right tabular-nums">
                        {t._count.entries}
                        {t.maxParticipants ? ` / ${t.maxParticipants}` : ""}
                      </ConsoleTableTd>
                      <ConsoleTableTd className="text-right tabular-nums">{approvedMap[t.id] ?? 0}</ConsoleTableTd>
                      <ConsoleTableTd className="text-right tabular-nums">{pendingMap[t.id] ?? 0}</ConsoleTableTd>
                      <ConsoleTableTd>
                        <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusTone(t.status)}`}>
                          {statusLabel(t.status)}
                        </span>
                      </ConsoleTableTd>
                      <ConsoleTableTd className="text-right">
                        <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-2">
                          <Link href={`/client/tournaments/${t.id}`} className="text-xs font-semibold text-indigo-800 underline dark:text-indigo-300">
                            대회현황
                          </Link>
                          {canMutate ? (
                            <ClientTournamentDeleteControl tournamentId={t.id} tournamentName={t.name} variant="list-table" />
                          ) : null}
                        </div>
                      </ConsoleTableTd>
                    </ConsoleTableRow>
                  ))}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>

            <div className="space-y-3 p-2 md:hidden">
              {tournaments.map((t) => (
                <div
                  key={t.id}
                  className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/client/tournaments/${t.id}`} className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t.name}</h3>
                    </Link>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${statusTone(t.status)}`}>
                        {statusLabel(t.status)}
                      </span>
                      {canMutate ? (
                        <ClientTournamentDeleteControl tournamentId={t.id} tournamentName={t.name} variant="list-card" />
                      ) : null}
                    </div>
                  </div>
                  <Link href={`/client/tournaments/${t.id}`} className="mt-1 block text-[11px] text-zinc-500">
                    {formatKoreanDateWithWeekday(t.startAt)}
                  </Link>
                  <Link href={`/client/tournaments/${t.id}`} className="mt-2 block text-[11px] text-zinc-700 dark:text-zinc-300">
                    신청자 {t._count.entries}
                    {t.maxParticipants ? ` / ${t.maxParticipants}` : ""} · 승인 {approvedMap[t.id] ?? 0} · 미승인 {pendingMap[t.id] ?? 0}
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </ConsoleSection>
    </div>
  );
}
