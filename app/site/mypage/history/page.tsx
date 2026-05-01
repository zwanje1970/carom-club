import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getUserById } from "../../../../lib/surface-read";
import SiteShellFrame from "../../components/SiteShellFrame";
import MypageApplicationsDeferred from "../MypageApplicationsDeferred";
import MypageHistoryDynamicMount from "./MypageHistoryDynamicMount";

export default async function SiteMypageHistoryPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login?next=/site/mypage/history");
  }

  if (!(await getUserById(session.userId))) {
    redirect("/login?next=/site/mypage/history");
  }

  return (
    <SiteShellFrame brandTitle="지난 대회">
      <section className="site-site-gray-main v3-stack site-mypage-shell">
        <MypageApplicationsDeferred />

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">종료 / 지난 신청 기록</h2>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            대회가 종료되었거나 진행 중 신청 목록에서 사라진 기록입니다.
          </p>

          <MypageHistoryDynamicMount />
        </section>

        <Link className="secondary-button" href="/site/mypage" style={{ alignSelf: "flex-start" }}>
          마이페이지로
        </Link>
      </section>
    </SiteShellFrame>
  );
}
