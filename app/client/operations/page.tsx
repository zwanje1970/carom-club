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

export const metadata = {
  title: "운영 관리",
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
        <ConsolePageHeader title="운영 관리" description="먼저 업체를 선택·설정해 주세요." />
        <Link
          href="/client/setup"
          className="inline-block rounded-sm border border-zinc-300 px-3 py-2 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
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

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="운영 관리"
        title="대회"
        description={`조직 「${org?.name ?? "—"}」 소속 대회만 표시됩니다.`}
        actions={
          <Link
            href="/client/operations/tournaments/new"
            className="rounded-sm border border-zinc-800 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            새 대회
          </Link>
        }
      />

      <ConsoleSection title="대회 목록" flush>
        {tournaments.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">등록된 대회가 없습니다.</p>
        ) : (
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
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Link
                          href={`/client/operations/tournaments/${t.id}/edit`}
                          className="rounded-sm border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          수정
                        </Link>
                        <Link
                          href={`/client/operations/tournaments/${t.id}/participant-roster`}
                          className="rounded-sm border border-zinc-600 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          명단 확정
                        </Link>
                        <Link
                          href={`/client/operations/tournaments/${t.id}/bracket-build`}
                          className="rounded-sm border border-zinc-400 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                        >
                          대진 콘솔
                        </Link>
                        <Link
                          href={`/client/operations/tournaments/${t.id}/bracket`}
                          className="rounded-sm border border-indigo-600 px-2 py-1 text-[11px] font-medium text-indigo-800 hover:bg-indigo-50 dark:border-indigo-500 dark:text-indigo-200 dark:hover:bg-indigo-950/50"
                        >
                          브래킷 편집
                        </Link>
                        <Link
                          href={`/client/operations/tournaments/${t.id}/participants`}
                          className="rounded-sm border border-zinc-800 bg-zinc-800 px-2 py-1 text-[11px] font-medium text-white hover:bg-zinc-900 dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-white"
                        >
                          참가자
                        </Link>
                        <Link
                          href={`/client/tournaments/${t.id}`}
                          className="rounded-sm border border-zinc-300 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          콘솔 상세
                        </Link>
                      </div>
                    </ConsoleTableTd>
                  </ConsoleTableRow>
                );
              })}
            </ConsoleTableBody>
          </ConsoleTable>
        )}
      </ConsoleSection>
    </div>
  );
}
