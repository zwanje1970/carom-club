import Link from "next/link";

export default function ClientPendingPage() {
  return (
    <main className="v3-page v3-stack" style={{ maxWidth: "34rem", margin: "0 auto" }}>
      <h1 className="v3-h1">클라이언트 승인 대기</h1>

      <section className="v3-box v3-stack">
        <p>현재 상태: 승인 대기 중</p>
        <p>신청이 정상적으로 접수되었습니다.</p>
        <p>현재 관리자 승인 대기 중입니다.</p>
        <p>승인이 완료되면 대회 생성, 참가자 관리 등의 기능을 이용하실 수 있습니다.</p>
        <p>※ 승인까지 시간이 걸릴 수 있으니 잠시만 기다려 주세요.</p>
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
