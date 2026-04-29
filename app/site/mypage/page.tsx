import { cookies, headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../../lib/is-carom-club-mobile-app-shell";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { getUserById } from "../../../lib/surface-read";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteMypageClient from "./SiteMypageClient";

export default async function SiteMypagePage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login?next=/site/mypage");
  }

  const user = await getUserById(session.userId);
  if (!user) {
    redirect("/login?next=/site/mypage");
  }

  const headerList = await headers();
  const hidePlatformDashboardLink = isCaromClubMobileAppShell(headerList);

  return (
    <SiteShellFrame brandTitle="마이페이지">
      <SiteMypageClient
        hidePlatformDashboardLink={hidePlatformDashboardLink}
        user={{
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          email: user.email ?? null,
          phone: user.phone ?? null,
          role: user.role,
        }}
      />
    </SiteShellFrame>
  );
}
