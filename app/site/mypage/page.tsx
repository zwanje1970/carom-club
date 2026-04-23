import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getTournamentById,
  getUserById,
  listNotificationsByUserId,
  listTournamentApplicationsByUserId,
  TournamentApplicationStatus,
} from "../../../lib/server/dev-store";
import RecentNotifications from "./RecentNotifications";
import LogoutButton from "../../components/LogoutButton";
import SiteShellFrame from "../components/SiteShellFrame";

function getStatusLabel(status: TournamentApplicationStatus): string {
  if (status === "APPLIED") return "신청 접수";
  if (status === "VERIFYING") return "검증 진행중";
  if (status === "WAITING_PAYMENT") return "입금 필요";
  if (status === "APPROVED") return "참가 확정";
  if (status === "REJECTED") return "참가 불가";
  return "진행중";
}

function isTournamentOngoing(dateText: string): boolean {
  const parsed = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return true;
  const now = new Date();
  return parsed.getTime() >= now.getTime();
}

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

  const [notifications, applications, clientApplicationStatus] = await Promise.all([
    listNotificationsByUserId(user.id, 20),
    listTournamentApplicationsByUserId(user.id),
    getClientStatusByUserId(user.id),
  ]);
  const clientApproved = clientApplicationStatus === "APPROVED";

  const applicationRows = await Promise.all(
    applications.map(async (application) => {
      const tournament = await getTournamentById(application.tournamentId);
      return {
        application,
        tournament,
      };
    })
  );

  const visibleStatuses: TournamentApplicationStatus[] = ["APPLIED", "VERIFYING", "WAITING_PAYMENT", "APPROVED"];
  const visibleRows = applicationRows.filter((row) => {
    if (!row.tournament) return false;
    if (!visibleStatuses.includes(row.application.status)) return false;
    if (row.application.status === "APPROVED" || row.application.status === "APPLIED") {
      return isTournamentOngoing(row.tournament.date);
    }
    return true;
  });

  return (
    <SiteShellFrame brandTitle="마이페이지">
      <section className="site-site-gray-main v3-stack site-mypage-shell">
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          내 정보 · 알림 · 신청 현황
        </p>

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">내 정보 요약</h2>
          <dl className="site-mypage-summary-dl">
            <div className="site-mypage-summary-row">
              <dt className="site-mypage-summary-dt">닉네임</dt>
              <dd className="site-mypage-summary-dd">{user.nickname}</dd>
            </div>
            <div className="site-mypage-summary-row">
              <dt className="site-mypage-summary-dt">이름</dt>
              <dd className="site-mypage-summary-dd">{user.name}</dd>
            </div>
            <div className="site-mypage-summary-row">
              <dt className="site-mypage-summary-dt">이메일</dt>
              <dd className="site-mypage-summary-dd">{user.email ?? "-"}</dd>
            </div>
            <div className="site-mypage-summary-row">
              <dt className="site-mypage-summary-dt">전화번호</dt>
              <dd className="site-mypage-summary-dd">{user.phone ?? "-"}</dd>
            </div>
            {clientApproved ? (
              <div className="site-mypage-summary-row">
                <dt className="site-mypage-summary-dt">회원 구분</dt>
                <dd className="site-mypage-summary-dd">클라이언트 회원</dd>
              </div>
            ) : null}
          </dl>
          <Link className="primary-button primary-button--block" href="/site/mypage/edit">
            내 정보 수정
          </Link>
        </section>

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">최근 알림</h2>
          <RecentNotifications initialItems={notifications} />
        </section>

        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">진행중 / 미완료 신청</h2>
          {visibleRows.length === 0 ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              현재 진행중 신청이 없습니다.
            </p>
          ) : (
            <ul className="site-mypage-link-list">
              {visibleRows.map((row) => (
                <li key={row.application.id}>
                  <Link
                    href={`/site/tournaments/${row.application.tournamentId}`}
                    className="site-mypage-link-row"
                  >
                    <div className="site-mypage-link-main">
                      <span className="site-mypage-link-title">{row.tournament?.title ?? "대회"}</span>
                      <span className="site-mypage-link-sub">
                        {getStatusLabel(row.application.status)} ·{" "}
                        {row.tournament?.date || row.application.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <span className="site-mypage-link-chevron" aria-hidden>
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="site-mypage-footer-actions">
          {clientApproved ? (
            <Link className="secondary-button" href="/client">
              클라이언트 대시보드
            </Link>
          ) : clientApplicationStatus === "PENDING" ? (
            <Link className="secondary-button" href="/client-status/pending">
              클라이언트 승인 대기
            </Link>
          ) : user.role === "PLATFORM" ? (
            <Link className="secondary-button" href="/platform">
              플랫폼 대시보드
            </Link>
          ) : (
            <Link className="secondary-button" href="/client-apply">
              클라이언트 신청
            </Link>
          )}
          <Link className="secondary-button" href="/site/mypage/history">
            지난 대회 보기
          </Link>
          <LogoutButton redirectTo="/" className="secondary-button site-mypage-logout" />
        </div>
      </section>
    </SiteShellFrame>
  );
}
