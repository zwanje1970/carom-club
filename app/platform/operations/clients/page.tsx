import Link from "next/link";
import { getApplicationSummaries } from "../../../../lib/surface-read";
import { ClientFirestoreUnavailableError } from "../../../../lib/server/firestore-client-applications";
import ClientApplicationsTableClient from "./ClientApplicationsTableClient";

export const dynamic = "force-dynamic";

export default async function PlatformOperationsClientsPage() {
  let summaries: Awaited<ReturnType<typeof getApplicationSummaries>>;
  try {
    summaries = await getApplicationSummaries();
  } catch (e) {
    if (e instanceof ClientFirestoreUnavailableError) {
      return (
        <main className="v3-page v3-stack">
          <h1 className="v3-h1">클라이언트(업체)</h1>
          <p className="v3-muted">
            클라이언트 신청 저장소(Firestore)가 설정되지 않아 목록을 불러올 수 없습니다. 환경 변수를 확인한 뒤 다시 시도해 주세요.
          </p>
        </main>
      );
    }
    throw e;
  }
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
    </main>
  );
}
