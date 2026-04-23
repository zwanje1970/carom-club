import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getTournamentById,
  getUserById,
  listTournamentApplicationsByUserId,
  TournamentApplicationStatus,
} from "../../../../lib/server/dev-store";
import SiteShellFrame from "../../components/SiteShellFrame";

function isTournamentOngoing(dateText: string): boolean {
  const parsed = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= Date.now();
}

function getHistoryStatusLabel(status: TournamentApplicationStatus): string {
  if (status === "APPROVED") return "참가 완료";
  if (status === "REJECTED") return "참가 불가";
  if (status === "VERIFYING") return "검증 진행중";
  if (status === "WAITING_PAYMENT") return "입금 필요";
  return "신청 접수";
}

export default async function SiteMypageHistoryPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login?next=/site/mypage/history");
  }

  const user = await getUserById(session.userId);
  if (!user) {
    redirect("/login?next=/site/mypage/history");
  }

  const applications = await listTournamentApplicationsByUserId(user.id);
  const rows = await Promise.all(
    applications.map(async (application) => ({
      application,
      tournament: await getTournamentById(application.tournamentId),
    }))
  );

  const historyRows = rows
    .filter((row) => {
      if (!row.tournament) return false;
      const ongoingApproved =
        row.application.status === "APPROVED" && isTournamentOngoing(row.tournament.date);
      const ongoingApplied =
        row.application.status === "APPLIED" && isTournamentOngoing(row.tournament.date);
      const ongoingIncomplete =
        row.application.status === "VERIFYING" || row.application.status === "WAITING_PAYMENT";
      const isActiveMypageItem = ongoingApproved || ongoingApplied || ongoingIncomplete;
      return !isActiveMypageItem;
    })
    .sort((a, b) => {
      const aTime = a.application.statusChangedAt || a.application.updatedAt || a.application.createdAt;
      const bTime = b.application.statusChangedAt || b.application.updatedAt || b.application.createdAt;
      return bTime.localeCompare(aTime);
    });

  return (
    <SiteShellFrame brandTitle="지난 대회">
      <section className="site-site-gray-main v3-stack site-mypage-shell">
        <section className="card-clean site-detail-inner-stack">
          <h2 className="site-mypage-card-title">종료 / 지난 신청 기록</h2>
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
            진행 중 목록에 나오지 않는 기록입니다.
          </p>

          {historyRows.length === 0 ? (
            <p className="v3-muted" style={{ margin: 0 }}>
              지난 대회 기록이 없습니다.
            </p>
          ) : (
            <ul className="site-mypage-link-list">
              {historyRows.map((row) => (
                <li key={row.application.id}>
                  <Link href={`/site/tournaments/${row.application.tournamentId}`} className="site-mypage-link-row">
                    <div className="site-mypage-link-main">
                      <span className="site-mypage-link-title">{row.tournament?.title ?? "대회"}</span>
                      <span className="site-mypage-link-sub">
                        {getHistoryStatusLabel(row.application.status)} ·{" "}
                        {(row.application.statusChangedAt || row.application.updatedAt || row.application.createdAt).slice(0, 10)}
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

        <Link className="secondary-button" href="/site/mypage" style={{ alignSelf: "flex-start" }}>
          진행 중 신청으로
        </Link>
      </section>
    </SiteShellFrame>
  );
}
