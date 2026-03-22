import Link from "next/link";
import { mdiHome, mdiViewDashboard } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export default async function AdminPage() {
  const copy = await getAdminCopy();

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

  const c = copy as Record<AdminCopyKey, string>;
  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiViewDashboard} title={getCopyValue(c, "admin.dashboard.title")} main>
        <Button
          icon={mdiHome}
          href="/"
          color="whiteDark"
          className="touch-manipulation"
          aria-label="사이트 홈으로 이동"
        />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400">
        {getCopyValue(c, "admin.dashboard.subtitle")}
      </p>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <CardBox>
          <Link href="/admin/venues" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.organizationCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{getCopyValue(c, "admin.dashboard.statClients")}</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/client-applications" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.pendingApplications}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{getCopyValue(c, "admin.dashboard.statPending")}</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/tournaments" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.tournamentCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{getCopyValue(c, "admin.dashboard.statTournaments")}</p>
          </Link>
        </CardBox>
        <CardBox>
          <Link href="/admin/inquiries" className="block">
            <p className="text-2xl font-semibold text-site-text">{stats.inquiryCount}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{getCopyValue(c, "admin.dashboard.statInquiries")}</p>
          </Link>
        </CardBox>
      </div>
    </SectionMain>
  );
}
