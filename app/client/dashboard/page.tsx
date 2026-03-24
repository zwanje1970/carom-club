import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
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

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "마감",
  BRACKET_GENERATED: "대진확정",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

const MATCH_STATUS: Record<string, string> = {
  PENDING: "대기",
  READY: "준비",
  BYE: "부전",
  IN_PROGRESS: "진행",
  COMPLETED: "완료",
};

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
    <div className="space-y-5">
      <ClientLoginWelcomeBanner show={welcome === "1"} />

      <ConsolePageHeader
        eyebrow="업무 시작"
        title="운영 대시보드"
        description={
          org
            ? `「${org.name}」 — 모집·대진·정산까지 한 화면에서 상태를 확인하고 바로 이동합니다.`
            : "조직이 연결되면 운영 지표가 표시됩니다."
        }
      />

      {!org ? (
        <section className="border border-amber-400 bg-amber-50 px-3 py-2 text-[11px] text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">소속된 업체가 없습니다.</p>
          <p className="mt-1">
            클라이언트 신청이 플랫폼 관리자에게 승인되면 업체가 생성됩니다.{" "}
            <Link href="/mypage" className="font-medium underline">
              마이페이지
            </Link>
            에서 신청 상태를 확인하세요.
          </p>
        </section>
      ) : (
        <>
          {/* 운영 현황 요약 */}
          <ConsoleSection title="운영 현황 요약" flush>
            <ConsoleTable>
              <ConsoleTableHead>
                <ConsoleTableRow>
                  <ConsoleTableTh>지표</ConsoleTableTh>
                  <ConsoleTableTh className="text-right">값</ConsoleTableTh>
                  <ConsoleTableTh className="text-right">이동</ConsoleTableTh>
                </ConsoleTableRow>
              </ConsoleTableHead>
              <ConsoleTableBody>
                <ConsoleTableRow>
                  <ConsoleTableTd>진행·모집 중 대회 (종료 제외)</ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                    {dash?.stats.activeTournaments ?? 0}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right">
                    <Link
                      href="/client/operations"
                      className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                    >
                      대회 운영
                    </Link>
                  </ConsoleTableTd>
                </ConsoleTableRow>
                <ConsoleTableRow>
                  <ConsoleTableTd>참가 승인 대기</ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                    {dash?.stats.pendingEntryApprovals ?? 0}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right">
                    <Link
                      href="/client/operations"
                      className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                    >
                      대회 운영
                    </Link>
                  </ConsoleTableTd>
                </ConsoleTableRow>
                <ConsoleTableRow>
                  <ConsoleTableTd>명단 확정 후 대진 미생성</ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                    {dash?.stats.bracketIncompleteLocked ?? 0}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right">
                    <Link
                      href="/client/operations"
                      className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                    >
                      대진 콘솔
                    </Link>
                  </ConsoleTableTd>
                </ConsoleTableRow>
                <ConsoleTableRow>
                  <ConsoleTableTd>종료 대회 정산 미완료</ConsoleTableTd>
                  <ConsoleTableTd className="text-right font-mono text-[12px] font-semibold">
                    {dash?.stats.settlementPendingFinished ?? 0}
                  </ConsoleTableTd>
                  <ConsoleTableTd className="text-right">
                    <Link
                      href="/client/billing"
                      className="text-[11px] font-medium text-indigo-800 underline dark:text-indigo-300"
                    >
                      정산
                    </Link>
                  </ConsoleTableTd>
                </ConsoleTableRow>
              </ConsoleTableBody>
            </ConsoleTable>
          </ConsoleSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ConsoleSection title="오늘 일정 (KST)" flush>
              {dash && dash.todayTournaments.length === 0 && dash.todayMatches.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">오늘 시작하는 대회나 예정된 본선 경기가 없습니다.</p>
              ) : (
                <>
                  {dash && dash.todayTournaments.length > 0 && (
                    <div className="border-b border-zinc-200 px-2 py-1.5 text-[10px] font-semibold uppercase text-zinc-500 dark:border-zinc-700">
                      대회 시작일이 오늘
                    </div>
                  )}
                  {dash?.todayTournaments.map((t) => (
                    <div
                      key={t.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-2 py-1.5 text-[11px] dark:border-zinc-800"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-zinc-500">{STATUS_LABEL[t.status] ?? t.status}</span>
                      <Link href={`/client/operations/tournaments/${t.id}/bracket`} className="text-indigo-800 underline dark:text-indigo-300">
                        브래킷
                      </Link>
                    </div>
                  ))}
                  {dash && dash.todayMatches.length > 0 && (
                    <div className="border-b border-zinc-200 px-2 py-1.5 text-[10px] font-semibold uppercase text-zinc-500 dark:border-zinc-700">
                      본선 경기 (예정 시각 오늘)
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
                      <span className="font-mono text-zinc-600">{MATCH_STATUS[m.status] ?? m.status}</span>
                      <span className="text-zinc-500">
                        {m.scheduledStartAt ? formatKoreanDateTime(m.scheduledStartAt) : "시간 미정"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </ConsoleSection>

            <ConsoleSection title="대기 작업" flush>
              {dash && dash.pendingTasks.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">즉시 처리할 큐가 없습니다.</p>
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
                        처리
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </ConsoleSection>
          </div>

          <ConsoleSection title="빠른 작업" plain>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Link
                href="/client/operations/tournaments/new"
                className="rounded-sm border border-zinc-800 bg-zinc-800 px-2.5 py-1.5 font-medium text-white dark:border-zinc-200 dark:bg-zinc-200 dark:text-zinc-900"
              >
                새 대회
              </Link>
              <Link
                href="/client/operations"
                className="rounded-sm border border-zinc-400 px-2.5 py-1.5 font-medium hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                참가 승인
              </Link>
              <Link
                href="/client/operations"
                className="rounded-sm border border-zinc-400 px-2.5 py-1.5 font-medium hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                대회 운영
              </Link>
              <Link
                href="/client/operations"
                className="rounded-sm border border-zinc-400 px-2.5 py-1.5 font-medium hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                대진·브래킷
              </Link>
              <Link
                href="/client/billing"
                className="rounded-sm border border-zinc-400 px-2.5 py-1.5 font-medium hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                정산
              </Link>
              <Link
                href="/client/promo"
                className="rounded-sm border border-zinc-400 px-2.5 py-1.5 font-medium hover:bg-zinc-200/60 dark:border-zinc-600 dark:hover:bg-zinc-800"
              >
                홍보
              </Link>
            </div>
          </ConsoleSection>

          <div className="grid gap-4 lg:grid-cols-2">
            <ConsoleSection title="최근 활동" flush>
              <div className="border-b border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700">
                대회 정보 갱신
              </div>
              {dash && dash.recentTournaments.length === 0 ? (
                <p className="p-2 text-[11px] text-zinc-500">기록이 없습니다.</p>
              ) : (
                <ConsoleTable>
                  <ConsoleTableHead>
                    <ConsoleTableRow>
                      <ConsoleTableTh>대회</ConsoleTableTh>
                      <ConsoleTableTh>상태</ConsoleTableTh>
                      <ConsoleTableTh>갱신</ConsoleTableTh>
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
                          {STATUS_LABEL[t.status] ?? t.status}
                        </ConsoleTableTd>
                        <ConsoleTableTd className="whitespace-nowrap text-zinc-500">
                          {formatKoreanDateTime(t.updatedAt)}
                        </ConsoleTableTd>
                        <ConsoleTableTd className="text-right">
                          <Link
                            href={`/client/tournaments/${t.id}`}
                            className="text-[10px] text-indigo-800 underline dark:text-indigo-300"
                          >
                            열기
                          </Link>
                        </ConsoleTableTd>
                      </ConsoleTableRow>
                    ))}
                  </ConsoleTableBody>
                </ConsoleTable>
              )}
              <div className="border-b border-t border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-500 dark:border-zinc-700">
                본선 경기 감사 로그
              </div>
              {dash && dash.recentAudit.length === 0 ? (
                <p className="p-2 text-[11px] text-zinc-500">최근 기록이 없습니다.</p>
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

            <ConsoleSection title="알림 · 주의" flush>
              {dash && dash.alerts.length === 0 ? (
                <p className="p-3 text-[11px] text-zinc-500">표시할 경고가 없습니다.</p>
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
                업체:{" "}
                {org.approvalStatus === "APPROVED"
                  ? org.clientType === "REGISTERED"
                    ? "등록업체 (연회원)"
                    : "일반업체"
                  : "승인 대기"}
              </p>
            </ConsoleSection>
          </div>

          <p className={cx("text-[10px]", consoleTextMuted)}>
            {getCopyValue(c, "client.dashboard.consoleTitle")} — 도움말은{" "}
            <Link href="/client/promo" className="underline">
              콘텐츠/홍보
            </Link>
            ·{" "}
            <Link href="/client/settings" className="underline">
              설정
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
