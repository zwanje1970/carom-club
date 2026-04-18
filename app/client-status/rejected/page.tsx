import Link from "next/link";

export default function ClientRejectedPage() {
  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <h1 className="v3-h1">클라이언트 승인 거절</h1>
      <p className="v3-muted">현재 신청은 거절 상태입니다. 사유 확인 후 재신청 흐름으로 진행해 주세요.</p>

      <section className="v3-box v3-stack">
        <p>현재 상태: REJECTED</p>
        <p>거절 상태에서는 client 실기능에 접근할 수 없습니다.</p>
      </section>

      <div className="v3-row">
        <Link className="v3-btn" href="/client-apply">
          재신청 화면
        </Link>
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
