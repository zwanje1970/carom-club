"use client";

import ClientDashboardHomeClient, {
  useClientDashboardSummaryBootstrap,
} from "./ClientDashboardHomeClient";

export default function ClientHomePage() {
  const bootstrap = useClientDashboardSummaryBootstrap();
  return (
    <main className="v3-page v3-stack ui-client-dashboard client-dashboard-main" style={{ gap: "1.15rem" }}>
      <ClientDashboardHomeClient bootstrap={bootstrap} />
    </main>
  );
}
