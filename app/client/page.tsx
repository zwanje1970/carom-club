import ClientDashboardHomeClient from "./ClientDashboardHomeClient";

export default function ClientHomePage() {
  return (
    <main
      data-client-dashboard-home="1"
      className="v3-page v3-stack ui-client-dashboard client-dashboard-main client-dashboard-home-root"
      style={{ gap: 0 }}
    >
      <header className="client-dashboard-home-root__header">
        <h1 className="v3-h1" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
          클라이언트 운영관리
        </h1>
      </header>
      <div className="client-dashboard-home-root__body">
        <ClientDashboardHomeClient />
      </div>
    </main>
  );
}
