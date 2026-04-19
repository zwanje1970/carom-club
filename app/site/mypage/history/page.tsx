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
      const ongoingIncomplete =
        row.application.status === "VERIFYING" || row.application.status === "WAITING_PAYMENT";
      const isActiveMypageItem = ongoingApproved || ongoingIncomplete;
      return !isActiveMypageItem;
    })
    .sort((a, b) => {
      const aTime = a.application.statusChangedAt || a.application.updatedAt || a.application.createdAt;
      const bTime = b.application.statusChangedAt || b.application.updatedAt || b.application.createdAt;
      return bTime.localeCompare(aTime);
    });

  return (
    <SiteShellFrame brandTitle="지난 대회">
      <section className="site-site-gray-main v3-stack">
      <p className="v3-muted">종료/지난 신청 기록</p>

      {historyRows.length === 0 ? (
        <p className="v3-muted">지난 대회 기록이 없습니다.</p>
      ) : (
        <ul className="v3-list">
          {historyRows.map((row) => (
            <li key={row.application.id}>
              <Link href={`/site/tournaments/${row.application.tournamentId}`}>
                {row.tournament?.title ?? "대회"} · {getHistoryStatusLabel(row.application.status)} ·{" "}
                {(row.application.statusChangedAt || row.application.updatedAt || row.application.createdAt).slice(0, 10)}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link className="v3-btn" href="/site/mypage">
        진행 중 신청으로
      </Link>
      </section>
    </SiteShellFrame>
  );
}
