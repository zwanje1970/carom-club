import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { ClientLoginWelcomeBanner } from "@/components/client/ClientLoginWelcomeBanner";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "초안",
  OPEN: "모집중",
  CLOSED: "마감",
  FINISHED: "종료",
  HIDDEN: "숨김",
};

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

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
      select: { name: true, slug: true, setupCompleted: true, approvalStatus: true, clientType: true, membershipType: true },
    });
    if (row) {
      org = row;
      if (!row.setupCompleted) {
        redirect("/client/setup");
      }
    }
  }

  let stats = { openCount: 0, closedCount: 0, finishedCount: 0, pendingEntries: 0 };
  let recentTournaments: { id: string; name: string; status: string; startAt: Date }[] = [];
  if (orgId) {
    const [openCount, closedCount, finishedCount, pendingEntries, recent] = await Promise.all([
      prisma.tournament.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.tournament.count({ where: { organizationId: orgId, status: "CLOSED" } }),
      prisma.tournament.count({ where: { organizationId: orgId, status: "FINISHED" } }),
      prisma.tournamentEntry.count({
        where: { tournament: { organizationId: orgId }, status: "APPLIED" },
      }),
      prisma.tournament.findMany({
        where: { organizationId: orgId },
        orderBy: { startAt: "desc" },
        take: 5,
        select: { id: true, name: true, status: true, startAt: true },
      }),
    ]);
    stats = { openCount, closedCount, finishedCount, pendingEntries };
    recentTournaments = recent;
  }

  return (
    <div className="space-y-8">
      <ClientLoginWelcomeBanner show={welcome === "1"} />
      <div>
        <h1 className="text-2xl font-bold text-site-text">대회 운영 대시보드</h1>
        <p className="mt-1 text-sm text-gray-600">
          {org ? `${org.name} 대회 운영 현황입니다.` : "내 조직 대회 운영 현황"}
        </p>
        {org && (
          <p className="mt-1 text-sm text-gray-500">
            {org.approvalStatus === "APPROVED"
              ? org.clientType === "REGISTERED"
                ? "등록업체 (연회원)"
                : "일반업체"
              : "승인 대기"}
          </p>
        )}
      </div>

      {!org ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="font-medium">소속된 업체가 없습니다.</p>
          <p className="mt-1">클라이언트 신청이 플랫폼 관리자에게 승인되면 업체가 생성됩니다. 승인 후 이 페이지를 새로고침해 주세요.</p>
          <Link href="/mypage" className="mt-3 inline-block text-amber-800 underline hover:no-underline dark:text-amber-200">
            마이페이지에서 신청 상태 확인
          </Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Link href="/client/tournaments?status=OPEN" className="rounded-lg border border-site-border bg-site-card p-4">
              <p className="text-2xl font-semibold text-site-text">{stats.openCount}</p>
              <p className="mt-1 text-sm text-gray-500">접수중 대회</p>
            </Link>
            <Link href="/client/tournaments?status=CLOSED" className="rounded-lg border border-site-border bg-site-card p-4">
              <p className="text-2xl font-semibold text-site-text">{stats.closedCount}</p>
              <p className="mt-1 text-sm text-gray-500">마감 대회</p>
            </Link>
            <Link href="/client/tournaments?status=FINISHED" className="rounded-lg border border-site-border bg-site-card p-4">
              <p className="text-2xl font-semibold text-site-text">{stats.finishedCount}</p>
              <p className="mt-1 text-sm text-gray-500">종료 대회</p>
            </Link>
            <Link href="/client/participants" className="rounded-lg border border-site-border bg-site-card p-4">
              <p className="text-2xl font-semibold text-site-text">{stats.pendingEntries}</p>
              <p className="mt-1 text-sm text-gray-500">참가 승인 대기</p>
            </Link>
          </section>

          <section className="rounded-lg border border-site-border bg-site-card p-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">빠른 작업</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/client/tournaments/new"
                className="rounded-lg bg-site-primary px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                새 대회 만들기
              </Link>
              <Link href="/client/tournaments" className="rounded-lg border border-site-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800">
                내 대회 보기
              </Link>
              <Link href="/client/participants" className="rounded-lg border border-site-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800">
                참가자 관리
              </Link>
              <Link href="/client/zones" className="rounded-lg border border-site-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800">
                부/권역 설정
              </Link>
              <Link href="/client/brackets" className="rounded-lg border border-site-border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800">
                대진표 관리
              </Link>
            </div>
          </section>

          <section className="rounded-lg border border-site-border bg-site-card p-4">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-slate-200">최근 대회</h2>
            {recentTournaments.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">등록된 대회가 없습니다.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recentTournaments.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded border border-site-border bg-site-bg px-3 py-2 text-sm">
                    <span className="font-medium text-site-text">{t.name}</span>
                    <span className="text-gray-500">{STATUS_LABEL[t.status] ?? t.status}</span>
                    <Link href={`/client/tournaments/${t.id}`} className="text-site-primary hover:underline">
                      관리
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3">
              <Link href="/client/tournaments" className="text-sm text-site-primary hover:underline">
                전체 대회 목록 →
              </Link>
            </p>
          </section>
        </>
      )}
    </div>
  );
}
