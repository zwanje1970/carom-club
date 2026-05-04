import Link from "next/link";
import PlatformReconcilePublishedCardsButton from "./PlatformReconcilePublishedCardsButton";

export default function PlatformDataHubPage() {
  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted">
        <Link href="/platform" prefetch={false}>
        ← 플랫폼 홈
      </Link>
      </p>
      <p className="v3-muted">삭제된 항목(백업함)에서 복구하거나 완전 삭제합니다.</p>
      <ul className="v3-list">
        <li>
          <Link href="/platform/data/deleted" prefetch={false}>
            삭제된 항목 (백업함)
          </Link>
        </li>
      </ul>
      <section className="v3-stack" aria-labelledby="reconcile-published-heading">
        <h2 id="reconcile-published-heading" className="v3-h2">
          메인 슬라이드 게시카드
        </h2>
        <p className="v3-muted">
          고아·삭제된 대회·일정 종료(종료일 다음날부터)에 해당하는 게시카드를 메인에서 비활성화합니다. 메인 페이지에서는 실행되지
          않습니다.
        </p>
        <PlatformReconcilePublishedCardsButton />
      </section>
    </main>
  );
}
