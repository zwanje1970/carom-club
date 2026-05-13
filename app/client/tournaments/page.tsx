import Link from "next/link";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { resolveCanonicalUserIdForAuth } from "../../../lib/auth/resolve-canonical-user-id-for-auth";
import { listTournamentsByCreatorFirestore } from "../../../lib/server/firestore-tournaments";
import type { Tournament, TournamentStatusBadge } from "../../../lib/types/entities";
import TournamentCardOverflowMenu from "../tournament/TournamentCardOverflowMenu";

export const dynamic = "force-dynamic";

const KO_WEEKDAY_SHORT = ["일", "월", "화", "수", "목", "금", "토"] as const;

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

/** 목록 왼쪽: 첫 일정만 `YY/MM/DD (요)` 형태 */
function formatClientListPrimaryDateLine(t: Pick<Tournament, "date" | "eventDates">): string {
  const dates =
    t.eventDates && t.eventDates.length > 0
      ? [...t.eventDates].map((d) => d.trim()).filter(Boolean).sort()
      : t.date
        ? [t.date.trim()].filter(Boolean)
        : [];
  const first = dates[0];
  if (!first) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(first);
  if (!m) return first;
  const y2 = m[1]!.slice(2);
  const mo = m[2]!;
  const d = m[3]!;
  const dt = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00`);
  const wd = Number.isNaN(dt.getTime()) ? "" : ` (${KO_WEEKDAY_SHORT[dt.getDay()]})`;
  return `${y2}/${mo}/${d}${wd}`;
}

const secondaryActionLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.18rem 0.42rem",
  minHeight: 28,
  fontSize: "0.72rem",
  fontWeight: 600,
  lineHeight: 1.2,
  borderRadius: "4px",
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#475569",
  textDecoration: "none",
  boxShadow: "none",
};

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
              const settlementHref = `/client/settlement/${encodeURIComponent(t.id)}`;
              const bc = statusBadgeStyle(t.statusBadge);
              const scale = clientListBracketScaleLabel(t.maxParticipants);
              const dateLine = formatClientListPrimaryDateLine(t);
              const isLast = idx === tournaments.length - 1;
              return (
                <li
                  key={t.id}
                  style={{
                    borderBottom: isLast ? "none" : "1px solid #e2e8f0",
                    padding: "0.58rem 0.55rem",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(3.25rem, 3.75rem) minmax(0, 1fr) auto",
                      gap: "0.4rem 0.5rem",
                      alignItems: "start",
                    }}
                  >
                    <div
                      className="v3-stack"
                      style={{
                        gap: "0.18rem",
                        minWidth: 0,
                        fontSize: "0.72rem",
                        lineHeight: 1.25,
                        color: "#64748b",
                        fontWeight: 600,
                        textAlign: "left",
                      }}
                    >
                      <span style={{ color: "#0f172a", fontWeight: 800 }}>{scale}</span>
                      {dateLine ? (
                        <span style={{ wordBreak: "break-all", fontWeight: 600 }}>{dateLine}</span>
                      ) : null}
                    </div>
                    <div className="v3-stack" style={{ gap: "0.35rem", minWidth: 0 }}>
                      <div
                        className="v3-row"
                        style={{
                          alignItems: "flex-start",
                          gap: "0.35rem",
                          flexWrap: "wrap",
                          minWidth: 0,
                        }}
                      >
                        <Link
                          href={detailHref}
                          style={{
                            textDecoration: "none",
                            color: "#0f172a",
                            fontWeight: 800,
                            fontSize: "0.92rem",
                            lineHeight: 1.25,
                            wordBreak: "break-word",
                            flex: "1 1 8rem",
                            minWidth: 0,
                          }}
                        >
                          {t.title}
                        </Link>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.12rem 0.4rem",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            ...bc,
                          }}
                        >
                          {t.statusBadge}
                        </span>
                      </div>
                      <div
                        className="v3-row"
                        style={{
                          alignItems: "center",
                          gap: "0.35rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <Link prefetch={false} href={settlementHref} style={secondaryActionLinkStyle}>
                          대회정산
                        </Link>
                        <Link prefetch={false} href={`/client/tournaments/${t.id}/participants`} style={secondaryActionLinkStyle}>
                          신청자관리
                        </Link>
                        <Link prefetch={false} href={`/client/tournaments/${t.id}/bracket`} style={secondaryActionLinkStyle}>
                          대진표
                        </Link>
                      </div>
                    </div>
                    <div
                      style={{
                        justifySelf: "end",
                        alignSelf: "start",
                        flexShrink: 0,
                        paddingTop: "0.05rem",
                      }}
                    >
                      <TournamentCardOverflowMenu tournamentId={t.id} title={t.title} />
                    </div>
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
