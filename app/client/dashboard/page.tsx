import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";

export default async function ClientDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  let org: { name: string; slug: string; setupCompleted: boolean } | null = null;

  if (orgId) {
    const row = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, slug: true, setupCompleted: true },
    });
    if (row) {
      org = row;
      if (!row.setupCompleted) {
        redirect("/client/setup");
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">대시보드</h1>
      <p className="text-gray-600">
        당구장·동호회·연맹·주최자·강사 관리자용 대시보드입니다. 업체 설정을 마치면 대회·레슨·신청을 관리할 수 있습니다.
      </p>

      {org ? (
        <section className="rounded-lg border border-site-border bg-site-card p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">업체 설정 현황</h2>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-[100px_1fr]">
            <dt className="text-gray-500">업체명</dt>
            <dd className="font-medium text-site-text">{org.name}</dd>
            <dt className="text-gray-500">주소(slug)</dt>
            <dd className="text-gray-700">{org.slug}</dd>
            <dt className="text-gray-500">설정 완료</dt>
            <dd className="text-gray-700">{org.setupCompleted ? "완료" : "미완료"}</dd>
          </dl>
          <div className="mt-4">
            <Link
              href="/client/setup"
              className="inline-flex items-center rounded-lg border border-site-border bg-site-bg px-4 py-2 text-sm font-medium text-site-text hover:bg-gray-100"
            >
              업체 설정 수정
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">소속된 업체가 없습니다.</p>
          <p className="mt-1">클라이언트 신청이 플랫폼 관리자에게 승인되면 업체가 생성됩니다. 승인 후 이 페이지를 새로고침해 주세요.</p>
          <Link href="/mypage" className="mt-3 inline-block text-amber-800 underline hover:no-underline">
            마이페이지에서 신청 상태 확인
          </Link>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          href="/client/setup"
          className="rounded-lg border border-site-border bg-site-card px-4 py-2.5 text-sm font-medium text-site-text hover:bg-gray-50"
        >
          업체 설정
        </Link>
        <Link
          href="/client/tournaments"
          className="rounded-lg border border-site-border bg-site-card px-4 py-2.5 text-sm font-medium text-site-text hover:bg-gray-50"
        >
          대회 관리
        </Link>
      </div>
    </div>
  );
}
