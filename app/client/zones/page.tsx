import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";

export default async function ClientZonesPage() {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-site-text">부/권역 설정</h1>
        <p className="text-gray-600">먼저 업체 설정을 완료해 주세요.</p>
        <Link href="/client/setup" className="inline-block rounded-lg bg-site-primary px-4 py-2 text-white hover:opacity-90">
          업체 설정
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">부/권역 설정</h1>
      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <p className="text-gray-600">
          대회별 권역 연결은 각 대회 상세 → 부/권역 탭에서 설정할 수 있습니다. 권역별 예선·본선 운영 시 사용합니다.
        </p>
        <Link href="/client/tournaments" className="mt-4 inline-block text-site-primary hover:underline">
          내 대회 목록에서 대회 선택 후 부/권역 탭으로 이동
        </Link>
      </div>
    </div>
  );
}
