import Link from "next/link";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { formatTournamentScheduleLabel, listTournamentsByCreator } from "../../../lib/server/dev-store";
import type { TournamentStatusBadge } from "../../../lib/server/dev-store";
import TournamentCardOverflowMenu from "./TournamentCardOverflowMenu";

export const dynamic = "force-dynamic";

function statusBadgeStyle(badge: TournamentStatusBadge): { background: string; color: string } {
  if (badge === "모집중") {
    return { background: "#fef3c7", color: "#92400e" };
  }
  if (badge === "마감" || badge === "종료") {
    return { background: "#f3f4f6", color: "#4b5563" };
  }
  return { background: "#eff6ff", color: "#1e3a5f" };
}

export default async function ClientTournamentOperationsPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const tournaments = session ? await listTournamentsByCreator(session.userId) : [];

  return (
    <main className="v3-page v3-stack ui-client-dashboard">
      <div
        className="v3-row ui-client-dashboard-header"
        style={{ justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}
      >
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client" style={{ padding: "0.5rem 0.9rem" }}>
            ← 대시보드
          </Link>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            대회관리
          </h1>
        </div>
        <Link className="ui-btn-primary-solid" href="/client/tournaments/new" style={{ padding: "0.55rem 1rem" }}>
          새 대회 생성
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <p className="v3-muted">생성된 대회가 없습니다.</p>
      ) : (
        <ul className="v3-stack" style={{ gap: "1rem", listStyle: "none", margin: 0, padding: 0 }}>
          {tournaments.map((t) => {
            const detailHref = `/client/tournaments/${t.id}`;
            const bc = statusBadgeStyle(t.statusBadge);
            const scheduleLine = formatTournamentScheduleLabel(t);
            return (
              <li key={t.id}>
                <section
                  className="v3-box"
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: "0.5rem",
                    padding: "0.85rem 1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.65rem",
                  }}
                >
                  <div
                    className="v3-row"
                    style={{
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                    }}
                  >
                    <Link
                      href={detailHref}
                      style={{
                        textDecoration: "none",
                        color: "inherit",
                        display: "block",
                        flex: "1 1 auto",
                        minWidth: 0,
                      }}
                    >
                      <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "0.35rem",
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            ...bc,
                          }}
                        >
                          {t.statusBadge}
                        </span>
                      </div>
                      <h2 className="v3-h2" style={{ margin: "0.35rem 0 0", fontSize: "1.1rem" }}>
                        {t.title}
                      </h2>
                      <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.95rem" }}>
                        {scheduleLine} · {t.location}
                      </p>
                    </Link>
                    <div style={{ flexShrink: 0, alignSelf: "flex-start" }}>
                      <TournamentCardOverflowMenu tournamentId={t.id} title={t.title} />
                    </div>
                  </div>
                  <div className="v3-row" style={{ alignItems: "center", gap: "0.35rem", justifyContent: "flex-start" }}>
                    <Link
                      className="v3-btn"
                      href={`/client/tournaments/${t.id}/participants`}
                      style={{ padding: "0.35rem 0.55rem", fontSize: "0.85rem" }}
                    >
                      신청자
                    </Link>
                    <Link
                      className="v3-btn"
                      href={`/client/tournaments/${t.id}/bracket`}
                      style={{ padding: "0.35rem 0.55rem", fontSize: "0.85rem" }}
                    >
                      대진표
                    </Link>
                  </div>
                </section>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
