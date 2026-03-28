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

export const metadata = {
  title: "대회 운영",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "임시저장",
  OPEN: "모집중",
  CLOSED: "마감",
  BRACKET_GENERATED: "대진 확정",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

export default async function ClientOperationsPage() {
  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) redirect("/");

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <ConsolePageHeader title="대회 운영" description="먼저 업체를 선택·설정해 주세요." />
        <Link
          href="/client/setup"
          className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-300 px-4 text-xs font-medium dark:border-zinc-600"
        >
          업체 설정
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
        eyebrow="대회 운영"
        title="대회 운영"
        description={`조직 「${org?.name ?? "—"}」 소속 대회만 표시됩니다.`}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/client/operations/push"
              className="min-h-[44px] items-center rounded-md border border-zinc-300 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800 inline-flex"
            >
              푸시 발송
            </Link>
            <Link
              href="/client/operations/tournaments/new"
              className="inline-flex min-h-[44px] items-center rounded-md border border-zinc-800 bg-zinc-800 px-3 text-xs font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              새 대회
            </Link>
          </div>
        }
      />

      <OperationsQuickActions firstTournamentId={firstId} />

      <ConsoleSection title="등록된 대회" flush>
        {tournaments.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">등록된 대회가 없습니다.</p>
        ) : (
          <>
            <div className="hidden lg:block">
              <ConsoleTable>
                <ConsoleTableHead>
                  <ConsoleTableRow>
                    <ConsoleTableTh>대회명</ConsoleTableTh>
                    <ConsoleTableTh>일정</ConsoleTableTh>
                    <ConsoleTableTh>장소</ConsoleTableTh>
                    <ConsoleTableTh>참가비</ConsoleTableTh>
                    <ConsoleTableTh>신청</ConsoleTableTh>
                    <ConsoleTableTh>상태</ConsoleTableTh>
                    <ConsoleTableTh className="text-right">작업</ConsoleTableTh>
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
                            {t.venue?.trim() || "—"}
                          </span>
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          {t.entryFee != null ? `${Number(t.entryFee).toLocaleString()}원` : "—"}
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          {confirmed}
                          {max != null && max > 0 ? ` / ${max}` : ""}
                        </ConsoleTableTd>
                        <ConsoleTableTd>
                          <ConsoleBadge tone="neutral">{STATUS_LABEL[t.status] ?? t.status}</ConsoleBadge>
                        </ConsoleTableTd>
                        <ConsoleTableTd className="text-right">
                          <OperationsTournamentListRowActions tournamentId={t.id} />
                        </ConsoleTableTd>
                      </ConsoleTableRow>
                    );
                  })}
                </ConsoleTableBody>
              </ConsoleTable>
            </div>

            <div className="flex flex-col gap-3 lg:hidden">
              {tournaments.map((t) => {
                const confirmed = countMap[t.id] ?? 0;
                const max = t.maxParticipants;
                return (
                  <OperationsTournamentMobileCard
                    key={t.id}
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
