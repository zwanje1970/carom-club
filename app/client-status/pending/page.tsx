import Link from "next/link";

export default function ClientPendingPage() {
  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <h1 className="v3-h1">클라이언트 승인 대기</h1>
      <p className="v3-muted">신청은 접수되었고, 플랫폼 관리자의 승인 전까지 client 기능은 잠금 상태입니다.</p>

      <section className="v3-box v3-stack">
        <p>현재 상태: PENDING</p>
        <p>승인 전에는 대회 생성/참가자/정산 등 client 실기능에 접근할 수 없습니다.</p>
      </section>

      <div className="v3-row">
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
        <Link className="v3-btn" href="/login">
          다시 로그인
        </Link>
      </div>
    </main>
  );
}
