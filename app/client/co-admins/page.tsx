import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";

export default async function ClientCoAdminsPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">공동관리자 관리</h1>
        <p className="text-gray-600">먼저 업체 설정을 완료해 주세요.</p>
        <Link href="/client/setup" className="inline-block rounded-lg bg-site-primary px-4 py-2 text-white hover:opacity-90">
          업체 설정
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">공동관리자 관리</h1>
      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <p className="text-gray-600">
          공동관리자(권역 관리자 등) 배정 기능은 추후 제공 예정입니다. 대회별로 공동관리자를 지정할 수 있습니다.
        </p>
        <p className="mt-4 text-sm text-gray-500">
          각 대회 상세 → 공동관리자 탭에서 해당 대회의 공동관리자를 설정할 수 있습니다.
        </p>
        <Link href="/client/tournaments" className="mt-4 inline-block text-site-primary hover:underline">
          내 대회로 이동
        </Link>
      </div>
    </div>
  );
}
