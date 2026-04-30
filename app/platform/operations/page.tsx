import AdminCard, { AdminCardGrid } from "../../components/admin/AdminCard";

export default function PlatformOperationsPage() {
  return (
    <main className="v3-page v3-stack" style={{ gap: "1.15rem", paddingTop: "0.35rem" }}>
      <p className="v3-muted">관리 대상(클라이언트 · 회원 · 문의) 기준으로 묶었습니다.</p>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          클라이언트 관리
        </h2>
        <AdminCardGrid>
          <AdminCard href="/platform/operations/clients" title="클라이언트 신청관리" description="신청 검토·승인 처리" />
          <AdminCard href="/platform/operations/clients/list" title="클라이언트 목록" description="등록 클라이언트 조회" />
          <AdminCard href="/platform/operations/settlement" title="정산" description="정산 관련 메뉴" />
          <AdminCard href="/platform/operations/membership" title="연회원 설정" description="연회원 정책·설정" />
        </AdminCardGrid>
      </section>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          회원 관리
        </h2>
        <AdminCardGrid>
          <AdminCard href="/platform/operations/users" title="회원목록" description="플랫폼 회원 조회" />
          <AdminCard href="/platform/operations/push" title="플랫폼 푸시" description="푸시 발송·설정" />
        </AdminCardGrid>
      </section>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          문의 관리
        </h2>
        <AdminCardGrid>
          <AdminCard href="/platform/operations/support" title="문의 관리" description="클라이언트 제출 문의 처리" />
        </AdminCardGrid>
      </section>
    </main>
  );
}
