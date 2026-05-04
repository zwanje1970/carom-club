"use client";

import ClientDashboardGateClient from "./ClientDashboardGateClient";

export default function ClientHomePage() {
  return (
    <main className="v3-page v3-stack ui-client-dashboard client-dashboard-main" style={{ gap: "1.15rem" }}>
      <ClientDashboardGateClient />
    </main>
  );
}
