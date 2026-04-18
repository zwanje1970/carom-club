import Link from "next/link";

export default function ClientRestrictedPage() {
  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <h1 className="v3-h1">이용 제한</h1>
      <p className="v3-muted">현재 이용이 제한된 상태입니다. 관리자에게 문의하세요</p>
      <section className="v3-box v3-stack">
        <p>상태: 이용 제한</p>
        <p>클라이언트 주요 기능에 접근할 수 없습니다.</p>
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
