import Link from "next/link";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { resolveCanonicalUserIdForAuth } from "../../../lib/auth/resolve-canonical-user-id-for-auth";
import { listTournamentsByCreatorFirestore } from "../../../lib/server/firestore-tournaments";
import { formatTournamentScheduleLabel } from "../../../lib/tournament-schedule";
import type { TournamentStatusBadge } from "../../../lib/types/entities";
import TournamentCardOverflowMenu from "../tournament/TournamentCardOverflowMenu";

export const dynamic = "force-dynamic";

function statusBadgeStyle(badge: TournamentStatusBadge): { background: string; color: string } {
  if (badge === "모집중") {
    return { background: "#fef3c7", color: "#92400e" };
  }
  if (badge === "마감임박") {
    return { background: "#ffedd5", color: "#9a3412" };
  }
  if (badge === "마감" || badge === "종료") {
    return { background: "#f3f4f6", color: "#4b5563" };
  }
  if (badge === "진행중") {
    return { background: "#dbeafe", color: "#1e40af" };
  }
  if (badge === "예정") {
    return { background: "#ecfdf5", color: "#166534" };
  }
  return { background: "#eff6ff", color: "#1e3a5f" };
}

function clientListBracketScaleLabel(maxParticipants: number): string {
  const k = Math.floor(Number(maxParticipants));
  if (!Number.isFinite(k) || k <= 0) return "—";
  return `${k}강`;
}

export default async function ClientTournamentsListPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const tournaments = session
    ? await listTournamentsByCreatorFirestore(await resolveCanonicalUserIdForAuth(session.userId))
    : [];

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted" style={{ margin: "0 0 0.35rem", fontSize: "0.88rem" }}>
        로그인 사용자 기준으로 생성된 대회를 확인합니다.
      </p>

      <section>
        {tournaments.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            생성된 대회가 없습니다.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              background: "#fff",
              overflow: "hidden",
            }}
          >
            {tournaments.map((t, idx) => {
              const detailHref = `/client/tournaments/${t.id}`;
              const bc = statusBadgeStyle(t.statusBadge);
              const scheduleLine = formatTournamentScheduleLabel(t);
              const scale = clientListBracketScaleLabel(t.maxParticipants);
              const venue = (t.location ?? "").trim();
              const isLast = idx === tournaments.length - 1;
              return (
                <li
                  key={t.id}
                  style={{
                    borderBottom: isLast ? "none" : "1px solid #e2e8f0",
                    padding: "0.45rem 0.5rem",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(3.1rem, 3.6rem) minmax(0, 1fr) auto",
                      gap: "0.35rem 0.45rem",
                      alignItems: "start",
                    }}
                  >
                    <div
                      className="v3-stack"
                      style={{
                        gap: "0.12rem",
                        minWidth: 0,
                        fontSize: "0.72rem",
                        lineHeight: 1.25,
                        color: "#64748b",
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#0f172a", fontWeight: 800 }}>{scale}</span>
                      {scheduleLine ? (
                        <span style={{ wordBreak: "break-all", fontWeight: 600 }}>{scheduleLine}</span>
                      ) : null}
                    </div>
                    <div className="v3-stack" style={{ gap: "0.12rem", minWidth: 0 }}>
                      <Link
                        href={detailHref}
                        style={{
                          textDecoration: "none",
                          color: "#0f172a",
                          fontWeight: 800,
                          fontSize: "0.92rem",
                          lineHeight: 1.25,
                          wordBreak: "break-word",
                        }}
                      >
                        {t.title}
                      </Link>
                      {venue ? (
                        <span className="v3-muted" style={{ fontSize: "0.78rem", lineHeight: 1.3, margin: 0 }}>
                          {venue}
                        </span>
                      ) : null}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "flex-start",
                        justifyContent: "flex-end",
                        gap: "0.25rem",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.12rem 0.4rem",
                          borderRadius: "4px",
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          whiteSpace: "nowrap",
                          ...bc,
                        }}
                      >
                        {t.statusBadge}
                      </span>
                      <TournamentCardOverflowMenu tournamentId={t.id} title={t.title} />
                    </div>
                  </div>
                  <div
                    className="v3-row"
                    style={{
                      marginTop: "0.35rem",
                      alignItems: "center",
                      gap: "0.3rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <Link
                      className="v3-btn"
                      href={`/client/tournaments/${t.id}/participants`}
                      style={{ padding: "0.28rem 0.5rem", fontSize: "0.78rem", fontWeight: 700, minHeight: 36 }}
                    >
                      신청자 관리
                    </Link>
                    <Link
                      className="v3-btn"
                      href={`/client/tournaments/${t.id}/bracket`}
                      style={{ padding: "0.28rem 0.5rem", fontSize: "0.78rem", fontWeight: 700, minHeight: 36 }}
                    >
                      대진표
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
