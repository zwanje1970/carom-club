import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import GlobalHomeButton from "../components/GlobalHomeButton";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../lib/auth/session";
import { getClientDashboardPolicy, getClientStatusByUserId, getUserById } from "../../lib/surface-read";
import SitePcDashboardChromeShell from "../site/components/SitePcDashboardChromeShell";

export default async function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);

  if (!session) {
    redirect("/login?next=/client");
  }

  const currentUser = await getUserById(session.userId);
  if (!currentUser) {
    redirect("/login?next=/client");
  }

  // 1) role 우선: 쿠키 role이 아니라 저장소의 현재 role로 판단한다.
  if (currentUser.role === "PLATFORM") {
    redirect("/platform");
  }

  if (currentUser.role !== "CLIENT") {
    redirect("/client-apply");
  }

  // 2) 사용자 상태 차단: 회원관리에서 정지/삭제 시 즉시 접근 차단한다.
  if (currentUser.status === "SUSPENDED" || currentUser.status === "DELETED") {
    redirect("/client-status/restricted");
  }

  const clientStatus = await getClientStatusByUserId(session.userId);
  if (clientStatus === "APPROVED") {
    // 3) 조직 상태 차단
    const policy = await getClientDashboardPolicy(session.userId);
    if (policy.orgStatus === "SUSPENDED" || policy.orgStatus === "EXPELLED") {
      redirect("/client-status/restricted");
    }
    return (
      <>
        <SitePcDashboardChromeShell />
        <div className="app-mobile-bottom-nav-scroll-pad app-dashboard-shell">{children}</div>
        <GlobalHomeButton />
      </>
    );
  }
  if (clientStatus === "REJECTED") {
    redirect("/client-status/rejected");
  }

  redirect("/client-status/pending");
}
