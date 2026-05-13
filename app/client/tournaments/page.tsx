import Link from "next/link";
import type { CSSProperties } from "react";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../lib/auth/session";
import { resolveCanonicalUserIdForAuth } from "../../../lib/auth/resolve-canonical-user-id-for-auth";
import { getUserById } from "../../../lib/platform-api";
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
    return { background: "#f1f5f9", color: "#475569" };
  }
  if (badge === "진행중") {
    return { background: "#dbeafe", color: "#1e40af" };
  }
  if (badge === "예정") {
    return { background: "#ecfdf5", color: "#166534" };
  }
  return { background: "#f1f5f9", color: "#334155" };
}

function clientListBracketScaleLabel(maxParticipants: number): string {
  const k = Math.floor(Number(maxParticipants));
  if (!Number.isFinite(k) || k <= 0) return "—";
  return `${k}강`;
}

function splitGangLabel(scale: string): { num: string; suffix: string } {
  const m = /^(\d+)강$/.exec(scale.trim());
  if (m) return { num: m[1]!, suffix: "강" };
  return { num: scale, suffix: "" };
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

const secondaryActionLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.22rem 0.48rem",
  minHeight: 30,
  fontSize: "0.75rem",
  fontWeight: 500,
  lineHeight: 1.25,
  borderRadius: "4px",
  border: "1px solid #e5e7eb",
  background: "transparent",
  color: "#64748b",
  textDecoration: "none",
  boxShadow: "none",
};

function listCreatorDisplayName(user: Awaited<ReturnType<typeof getUserById>>): string {
  if (!user) return "회원";
  const name = typeof user.name === "string" ? user.name.trim() : "";
  if (name) return name;
  const nick = typeof user.nickname === "string" ? user.nickname.trim() : "";
  if (nick) return nick;
  const login = typeof user.loginId === "string" ? user.loginId.trim() : "";
  if (login) return login;
  return "회원";
}

export default async function ClientTournamentsListPage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const sessionUser = session ? await getUserById(session.userId) : null;
  const creatorLabel = listCreatorDisplayName(sessionUser);
  const tournaments = session
    ? await listTournamentsByCreatorFirestore(await resolveCanonicalUserIdForAuth(session.userId))
    : [];

  return (
    <main className="v3-page v3-stack" style={{ paddingTop: "0.35rem" }}>
      <p className="v3-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", lineHeight: 1.45, color: "#64748b" }}>
        {creatorLabel}님이 생성한 대회 목록입니다.
      </p>

      <section>
        {tournaments.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            생성된 대회가 없습니다.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              borderTop: "1px solid #e5e7eb",
            }}
          >
            {tournaments.map((t, idx) => {
              const detailHref = `/client/tournaments/${t.id}`;
              const settlementHref = `/client/settlement/${encodeURIComponent(t.id)}`;
              const bc = statusBadgeStyle(t.statusBadge);
              const scale = clientListBracketScaleLabel(t.maxParticipants);
              const { num: gangNum, suffix: gangSuffix } = splitGangLabel(scale);
              const dateLine = formatClientListPrimaryDateLine(t);
              const isLast = idx === tournaments.length - 1;
              return (
                <li
                  key={t.id}
                  style={{
                    borderBottom: isLast ? "none" : "1px solid #e5e7eb",
                    padding: "0.72rem 0.15rem",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(3.35rem, 5rem) minmax(0, 1fr) auto",
                      gap: "0.45rem 0.55rem",
                      alignItems: "start",
                    }}
                  >
                    <div
                      className="v3-stack"
                      style={{
                        gap: "0.22rem",
                        minWidth: 0,
                        textAlign: "left",
                        alignItems: "flex-start",
                        justifyContent: "center",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          flexDirection: "row",
                          alignItems: "baseline",
                          gap: "0.04em",
                          color: "#dc2626",
                          lineHeight: 1.35,
                          maxWidth: "100%",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "1.28rem",
                            fontWeight: 300,
                            letterSpacing: "-0.03em",
                            lineHeight: 1,
                          }}
                        >
                          {gangNum}
                        </span>
                        {gangSuffix ? (
                          <span style={{ fontSize: "0.8125rem", fontWeight: 400, letterSpacing: "-0.01em" }}>{gangSuffix}</span>
                        ) : null}
                      </span>
                      {dateLine ? (
                        <span
                          style={{
                            wordBreak: "break-all",
                            fontSize: "0.8125rem",
                            fontWeight: 400,
                            lineHeight: 1.45,
                            color: "#94a3b8",
                          }}
                        >
                          {dateLine}
                        </span>
                      ) : null}
                    </div>
                    <div className="v3-stack" style={{ gap: "0.38rem", minWidth: 0 }}>
                      <div
                        className="v3-row"
                        style={{
                          alignItems: "flex-start",
                          gap: "0.4rem",
                          flexWrap: "wrap",
                          minWidth: 0,
                        }}
                      >
                        <Link
                          href={detailHref}
                          style={{
                            textDecoration: "none",
                            color: "#0f172a",
                            fontWeight: 500,
                            fontSize: "0.9375rem",
                            lineHeight: 1.4,
                            letterSpacing: "-0.015em",
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
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 500,
                            lineHeight: 1.25,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            letterSpacing: "-0.02em",
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
                          gap: "0.38rem",
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
                        paddingTop: "0.08rem",
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
