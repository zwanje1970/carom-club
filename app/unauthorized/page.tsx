import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "32rem", margin: "0 auto" }}>
      <h1 className="v3-h1">접근 권한이 없습니다</h1>
      <p className="v3-muted">현재 계정 권한으로는 요청한 영역에 접근할 수 없습니다.</p>

      <section className="v3-box v3-stack">
        <p>필요한 권한이 있는 계정으로 다시 로그인해 주세요.</p>
        <p className="v3-muted">- /client: CLIENT</p>
        <p className="v3-muted">- /platform: PLATFORM</p>
      </section>

      <div className="v3-row">
        <Link className="v3-btn" href="/login">
          로그인으로
        </Link>
        <Link className="v3-btn" href="/">
          홈으로
        </Link>
      </div>
    </main>
  );
}
