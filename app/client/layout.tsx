import type { Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isCaromClubMobileAppShell } from "../../lib/is-carom-club-mobile-app-shell";
import AdminFabServerBridge from "../components/AdminFabServerBridge";
import DashboardMobileChromeLayout from "../components/DashboardMobileChromeLayout";
import GlobalHomeButton from "../components/GlobalHomeButton";
import { getClientStatusByUserId } from "../../lib/surface-read";
import { getRequestSessionUser } from "../../lib/server/request-session-user";
import { resolveClientOrganizationForDashboardPolicy } from "../../lib/server/platform-backing-store";
import SitePcDashboardChromeShell from "../site/components/SitePcDashboardChromeShell";

/** 모바일 브라우저·WebView 상단 영역 — 공개 사이트 standard 헤더(#4d7db5)와 동일 */
export const viewport: Viewport = {
  themeColor: "#4d7db5",
};

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const currentUser = await getRequestSessionUser();
  if (!currentUser) {
    redirect("/login?next=/client");
  }

  // 1) role 우선: 쿠키 role이 아니라 저장소의 현재 role로 판단한다.
  if (currentUser.role === "PLATFORM") {
    const headerList = await headers();
    redirect(isCaromClubMobileAppShell(headerList) ? "/site" : "/platform");
  }

  if (currentUser.role !== "CLIENT") {
    redirect("/client-apply");
  }

  // 2) 사용자 상태 차단: 회원관리에서 정지/삭제 시 즉시 접근 차단한다.
  if (currentUser.status === "SUSPENDED" || currentUser.status === "DELETED") {
    redirect("/client-status/restricted");
  }

  const clientStatus = await getClientStatusByUserId(currentUser.id);
  if (clientStatus === "APPROVED") {
    // 3) 조직 상태 차단 — 대시보드 정책 전체(getClientDashboardPolicy)는 페이지 Suspense에서만 로드
    const orgForGuard = await resolveClientOrganizationForDashboardPolicy(currentUser.id);
    if (orgForGuard?.status === "SUSPENDED" || orgForGuard?.status === "EXPELLED") {
      redirect("/client-status/restricted");
    }
    return (
      <>
        <SitePcDashboardChromeShell />
        <DashboardMobileChromeLayout area="client">
          <div className="app-mobile-bottom-nav-scroll-pad app-dashboard-shell app-dashboard-shell--with-mobile-chrome">
            {children}
          </div>
        </DashboardMobileChromeLayout>
        <GlobalHomeButton />
        <AdminFabServerBridge />
      </>
    );
  }
  if (clientStatus === "REJECTED") {
    redirect("/client-status/rejected");
  }

  redirect("/client-status/pending");
}
