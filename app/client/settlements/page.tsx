import Link from "next/link";

/** 구 자동 합산(전체정산) 화면 — UI 비활성화. 경로는 유지. */
export default function ClientSettlementsLegacyDisabledPage() {
  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ paddingTop: "0.35rem" }}>
      <section className="v3-box v3-stack">
        <p className="v3-muted" style={{ margin: 0 }}>
          이전 방식의 전체 합산 화면은 사용하지 않습니다. 정산 허브에서 이후 단계를 안내합니다.
        </p>
        <Link className="ui-btn-primary-solid" href="/client/settlement">
          정산 허브로 이동
        </Link>
      </section>
    </main>
  );
}
