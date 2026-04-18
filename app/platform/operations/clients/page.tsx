import Link from "next/link";
import { getApplicationSummaries } from "../../../../lib/server/dev-store";
import ApplicationStatusUpdateForm from "./ApplicationStatusUpdateForm";

export const dynamic = "force-dynamic";

export default async function PlatformOperationsClientsPage() {
  const summaries = await getApplicationSummaries();
  const sorted = summaries;

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">클라이언트(업체)</h1>
      <p className="v3-muted">신청 상태를 대기/승인/거절로 자유 변경할 수 있습니다.</p>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">신청 관리</h2>
        {sorted.length === 0 ? (
          <p className="v3-muted">신청 내역이 없습니다.</p>
        ) : (
          <div className="v3-stack">
            {sorted.map(({ application, user }) => (
              <article key={application.id} className="v3-box v3-stack" style={{ background: "#fff" }}>
                <p>조직명: {application.organizationName}</p>
                <p>담당자: {application.contactName}</p>
                <p>연락처: {application.contactPhone}</p>
                <p>신청 유형: {application.requestedClientType === "REGISTERED" ? "연회원 신청" : "일반"}</p>
                <p>신청자: {user?.name ?? "-"}</p>
                <p>현재 상태: {application.status === "PENDING" ? "대기" : application.status === "APPROVED" ? "승인" : "거절"}</p>
                <p>신청일: {new Date(application.createdAt).toLocaleString("ko-KR")}</p>
                <p>검토일시: {application.reviewedAt ? new Date(application.reviewedAt).toLocaleString("ko-KR") : "-"}</p>
                <p>검토자 ID: {application.reviewedByUserId ?? "-"}</p>
                <p>거절 사유: {application.rejectedReason ?? "-"}</p>

                <ApplicationStatusUpdateForm
                  applicationId={application.id}
                  initialStatus={application.status}
                  initialRejectedReason={application.rejectedReason ?? ""}
                />
              </article>
            ))}
          </div>
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
