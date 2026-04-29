import Link from "next/link";
import { listAllTournaments } from "../../../lib/platform-api";
import { formatTournamentScheduleLabel } from "../../../lib/tournament-schedule";

export const dynamic = "force-dynamic";

export default async function PlatformTournamentsListPage() {
  const tournaments = await listAllTournaments();

  return (
    <main className="v3-page v3-stack">
      <p className="v3-muted">
        <Link href="/platform">← 플랫폼 홈</Link>
      </p>
      <h1 className="v3-h1">대회 관리 (플랫폼)</h1>
      <p className="v3-muted">목록에서 대회를 선택하면 상세·삭제·게시 카드 관리로 이동합니다.</p>
      <p className="v3-muted">
        <Link href="/platform/data/deleted">삭제된 항목 (백업함)</Link>
        {" · "}
        <Link href="/platform/data">데이터 관리</Link>
      </p>

      {tournaments.length === 0 ? (
        <p className="v3-muted">표시할 대회가 없습니다.</p>
      ) : (
        <ul className="v3-stack" style={{ listStyle: "none", margin: 0, padding: 0, gap: "0.75rem" }}>
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link className="v3-box v3-stack" href={`/platform/tournaments/${t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
                <strong>{t.title}</strong>
                <span className="v3-muted">{formatTournamentScheduleLabel(t)}</span>
                <span className="v3-muted" style={{ fontSize: "0.85rem" }}>
                  id: {t.id}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
