import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import SiteHeaderListBackLink from "../../components/SiteHeaderListBackLink";
import SiteShellFrame from "../../components/SiteShellFrame";
import MypageMatchRecordsClient from "./MypageMatchRecordsClient";

export const dynamic = "force-dynamic";

export default async function SiteMypageMatchRecordsPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login?next=/site/mypage/match-records");
  }

  return (
    <SiteShellFrame
      brandLeading={<SiteHeaderListBackLink href="/site/mypage" transition="mypage" />}
      brandTitle={<span className="site-home-brand-ellipsis">내 경기기록</span>}
    >
      <section className="site-site-gray-main v3-stack">
        <MypageMatchRecordsClient />
      </section>
    </SiteShellFrame>
  );
}
