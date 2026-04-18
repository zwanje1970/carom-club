import Link from "next/link";

export default function PlatformOperationsPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">운영 관리</h1>
      <p className="v3-muted">관리 대상(클라이언트 · 회원 · 문의) 기준으로 묶었습니다.</p>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          클라이언트 관리
        </h2>
        <ul className="v3-list">
          <li>
            <Link href="/platform/operations/clients">클라이언트 신청관리</Link>
          </li>
          <li>
            <Link href="/platform/operations/clients/list">클라이언트 목록</Link>
          </li>
          <li>
            <Link href="/platform/operations/settlement">정산</Link>
          </li>
          <li>
            <Link href="/platform/operations/membership">연회원 설정</Link>
          </li>
        </ul>
      </section>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          회원 관리
        </h2>
        <ul className="v3-list">
          <li>
            <Link href="/platform/operations/users">회원목록</Link>
          </li>
          <li>
            <Link href="/platform/operations/push">플랫폼 푸시</Link>
          </li>
        </ul>
      </section>

      <section className="v3-stack" style={{ gap: "0.5rem" }}>
        <h2 className="v3-h2" style={{ marginBottom: 0 }}>
          문의 관리
        </h2>
        <ul className="v3-list">
          <li>
            <Link href="/platform/operations/support">문의 관리 (클라이언트 제출)</Link>
          </li>
        </ul>
      </section>

      <Link className="v3-btn" href="/platform">
        플랫폼 홈
      </Link>
    </main>
  );
}
