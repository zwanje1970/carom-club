import Link from "next/link";
import { mdiViewDashboard } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import { DashboardMenuBox } from "@/components/admin/DashboardMenuBox";
import CardBox from "@/components/admin/_components/CardBox";
import { getAdminCopy } from "@/lib/admin-copy";
import { getMenuAside } from "@/components/admin/adminMenu";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export default async function AdminPage() {
  const copy = await getAdminCopy();
  const menuAside = getMenuAside(copy).filter((item) => item.href !== "/admin");

  let stats: {
    organizationCount: number;
    pendingApplications: number;
    tournamentCount: number;
    inquiryCount: number;
  } = { organizationCount: 0, pendingApplications: 0, tournamentCount: 0, inquiryCount: 0 };
  if (isDatabaseConfigured()) {
    try {
      const [organizationCount, pendingApplications, tournamentCount, inquiryCount] = await Promise.all([
        prisma.organization.count(),
        prisma.clientApplication.count({ where: { status: "PENDING" } }),
        prisma.tournament.count(),
        prisma.inquiry.count(),
      ]);
      stats = { organizationCount, pendingApplications, tournamentCount, inquiryCount };
    } catch {
      // ignore
    }
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title="플랫폼 운영 대시보드" main />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        플랫폼 운영·모니터링용 대시보드입니다. 대회 실무(생성/수정/참가자/대진표)는 클라이언트 관리자(/client) 콘솔에서 진행합니다.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CardBox>
          <Link href="/admin/venues" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.organizationCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">클라이언트</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/client-applications" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.pendingApplications}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">승인 대기</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/tournaments" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.tournamentCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">전체 대회</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/inquiries" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.inquiryCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">문의</p>
          </Link>
        </CardBox>
      </div>

      <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-slate-300">바로가기</h2>
      <DashboardMenuBox menu={menuAside} />
    </SectionMain>
  );
}
