import { cookies } from "next/headers";
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

  return (
    <SiteShellFrame brandTitle="마이페이지">
      <SiteMypageClient
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
