import ClientDashboardHomeClient from "./ClientDashboardHomeClient";

export default function ClientHomePage() {
  return (
    <main className="v3-page v3-stack ui-client-dashboard client-dashboard-main" style={{ gap: "1.15rem" }}>
      <section className="v3-stack" aria-live="polite" style={{ gap: "0.35rem" }}>
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          클라이언트 대시보드를 불러오는 중입니다. 아래 영역이 곧 표시됩니다.
        </p>
      </section>
      <ClientDashboardHomeClient />
    </main>
  );
}
