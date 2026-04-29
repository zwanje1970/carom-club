import Link from "next/link";

export default function ClientVenuesPage() {
  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">당구장 카드 발행</h1>
      <p className="v3-muted">이 화면은 당구장 카드 발행을 위한 최소 진입 화면입니다.</p>
      <section className="v3-box v3-stack">
        <p className="v3-muted" style={{ margin: 0 }}>
          등록된 클럽이 없습니다.{" "}
          <Link href="/site/venues">클럽안내</Link>
        </p>
      </section>
    </main>
  );
}
