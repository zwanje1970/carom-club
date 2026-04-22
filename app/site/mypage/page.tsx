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
      <section className="site-site-gray-main v3-stack">
      <section className="v3-box v3-stack">
        <h2 className="v3-h2">내 정보 요약</h2>
        <div className="v3-stack" style={{ gap: "0.4rem" }}>
          <p>
            <strong>닉네임:</strong> {user.nickname}
          </p>
          <p>
            <strong>이름:</strong> {user.name}
          </p>
          <p>
            <strong>이메일:</strong> {user.email ?? "-"}
          </p>
          <p>
            <strong>전화번호:</strong> {user.phone ?? "-"}
          </p>
          {clientApproved ? (
            <p style={{ margin: 0 }}>
              <strong>회원 구분:</strong> 클라이언트 회원
            </p>
          ) : null}
        </div>
        <Link className="v3-btn" href="/site/mypage/edit">
          내 정보 수정
        </Link>
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">최근 알림</h2>
        <RecentNotifications initialItems={notifications} />
      </section>

      <section className="v3-box v3-stack">
        <h2 className="v3-h2">진행중/미완료 신청</h2>
        {visibleRows.length === 0 ? (
          <p className="v3-muted">현재 진행중 신청이 없습니다.</p>
        ) : (
          <ul className="v3-list">
            {visibleRows.map((row) => (
              <li key={row.application.id}>
                <Link href={`/site/tournaments/${row.application.tournamentId}`}>
                  {row.tournament?.title ?? "대회"} · {getStatusLabel(row.application.status)} ·{" "}
                  {row.tournament?.date || row.application.createdAt.slice(0, 10)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="v3-row">
        {clientApproved ? (
          <Link className="v3-btn" href="/client">
            클라이언트 대시보드
          </Link>
        ) : clientApplicationStatus === "PENDING" ? (
          <Link className="v3-btn" href="/client-status/pending">
            클라이언트 승인 대기
          </Link>
        ) : user.role === "PLATFORM" ? (
          <Link className="v3-btn" href="/platform">
            플랫폼 대시보드
          </Link>
        ) : (
          <Link className="v3-btn" href="/client-apply">
            클라이언트 신청
          </Link>
        )}
        <Link className="v3-btn" href="/site/mypage/history">
          지난 대회 보기
        </Link>
        <LogoutButton redirectTo="/" />
      </div>
      </section>
    </SiteShellFrame>
  );
}
