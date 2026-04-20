import Link from "next/link";
import { getApplicationSummaries } from "../../../../lib/server/dev-store";
import ClientApplicationsTableClient from "./ClientApplicationsTableClient";

export const dynamic = "force-dynamic";

export default async function PlatformOperationsClientsPage() {
  const summaries = await getApplicationSummaries();
  const payload = summaries.map(({ application, user }) => ({
    application,
    userDisplayName: user?.name ?? null,
  }));

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">클라이언트(업체)</h1>
      <p className="v3-muted">신청 상태를 미확인·승인·거절로 관리합니다. 행을 눌러 상세·처리합니다.</p>

      <section className="v3-box v3-stack ui-platform-clients-section">
        <h2 className="v3-h2">신청 관리</h2>
        {summaries.length === 0 ? (
          <p className="v3-muted">신청 내역이 없습니다.</p>
        ) : (
          <ClientApplicationsTableClient initialSummaries={payload} />
        )}
      </section>

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        <Link className="v3-btn" href="/platform/operations/clients/list">
          승인된 클라이언트 목록
        </Link>
        <Link className="v3-btn" href="/platform/operations/membership">
          연회원 설정
        </Link>
      </div>

      <Link className="v3-btn" href="/platform/operations">
        운영 관리
      </Link>
    </main>
  );
}
