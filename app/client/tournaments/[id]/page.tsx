import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById } from "../../../../lib/platform-api";
import {
  getTournamentApplicationListCountsFirestore,
  listTournamentApplicationsListItemsByTournamentIdFirestore,
} from "../../../../lib/server/firestore-tournament-applications";
import { formatTournamentScheduleLabel } from "../../../../lib/tournament-schedule";
import type { TournamentStatusBadge } from "../../../../lib/types/entities";
import ClientTournamentParticipantsApplicationsBlock from "./ClientTournamentParticipantsApplicationsBlock";
import { parseClientParticipantFilter } from "./client-participant-filter-shared";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";

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

function divisionLineForSummary(rule: { divisionEnabled: boolean; divisionRulesJson: unknown[] | null }): string {
  if (rule.divisionEnabled && Array.isArray(rule.divisionRulesJson) && rule.divisionRulesJson.length > 0) {
    return `${rule.divisionRulesJson.length}부`;
  }
  return "—";
}

export default async function ClientTournamentManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string }>;
}) {
  const { id } = await params;
  const { f } = await searchParams;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const tournament = await getClientTournamentDetailPreviewById(id);

  if (!tournament) {
    notFound();
  }

  const viewerId = session ? await resolveCanonicalUserIdForAuth(session.userId) : "";
  const canView = Boolean(session && tournament.createdBy === viewerId);
  if (!canView) {
    notFound();
  }

  const [entries, participantCountSummary] = await Promise.all([
    listTournamentApplicationsListItemsByTournamentIdFirestore(id, { limit: 5 }),
    getTournamentApplicationListCountsFirestore(id),
  ]);
  const selected = parseClientParticipantFilter(f);
  const scheduleLine = formatTournamentScheduleLabel(tournament);
  const badgeStyle = statusBadgeStyle(tournament.statusBadge);
  const filterBaseHref = `/client/tournaments/${id}`;
  const bracketEnabled = tournament.statusBadge === "마감";

  return (
    <main className="v3-page v3-stack" style={{ gap: 0, paddingTop: 0 }}>
      <header
        style={{
          paddingBottom: "0.65rem",
          marginBottom: "0.5rem",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <div
          className="v3-row"
          style={{
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <h1
            className="v3-h1"
            style={{
              margin: "0.5rem 0 0.25rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              flex: "1 1 12rem",
              minWidth: 0,
            }}
          >
            {tournament.title}
          </h1>
          <div className="v3-stack" style={{ alignItems: "flex-end", flex: "0 1 auto", minWidth: "min(100%, 24rem)", gap: "0.35rem" }}>
            <span
              style={{
                ...badgeStyle,
                fontSize: "0.78rem",
                fontWeight: 800,
                padding: "0.2rem 0.55rem",
                borderRadius: "999px",
                whiteSpace: "nowrap",
              }}
            >
              {tournament.statusBadge}
            </span>
            <div style={{ width: "100%", fontSize: "0.88rem" }}>
              <TournamentBadgeCardManageRow tournamentId={id} initialStatus={tournament.statusBadge} />
            </div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: "0.92rem", color: "#374151" }}>
          {scheduleLine ? <span>대회일: {scheduleLine}</span> : <span className="v3-muted">대회일: —</span>}
        </p>
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem", color: "#374151" }}>
          강수(부): <strong>{divisionLineForSummary(tournament.rule)}</strong>
          {" · "}
          모집인원: <strong>{tournament.maxParticipants}명</strong>
        </p>
        <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
          참가신청 <strong>{participantCountSummary.total}</strong>건 / 모집 {tournament.maxParticipants}명
        </p>
      </header>

      <section className="v3-stack" style={{ gap: "0.45rem", marginBottom: "0.65rem" }}>
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          관리 메뉴
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(10.5rem, 1fr))",
            gap: "0.35rem",
            alignItems: "stretch",
          }}
        >
          <Link prefetch={false} className="v3-btn" href={`/client/tournaments/new?edit=${encodeURIComponent(id)}`} style={{ padding: "0.4rem 0.65rem", fontSize: "0.88rem" }}>
            대회 정보 수정
          </Link>
          <Link prefetch={false} className="v3-btn" href={`/client/tournaments/${id}/card-publish-v2`} style={{ padding: "0.4rem 0.65rem", fontSize: "0.88rem" }}>
            게시카드 작성·수정
          </Link>
          <Link prefetch={false} className="v3-btn" href={`/client/settlement/${encodeURIComponent(id)}`} style={{ padding: "0.4rem 0.65rem", fontSize: "0.88rem" }}>
            정산 관리
          </Link>
        </div>
      </section>

      <section className="v3-stack" style={{ gap: "0.45rem", marginBottom: "0.75rem" }}>
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          대진표
        </p>
        {bracketEnabled ? (
          <Link
            prefetch={false}
            className="ui-btn-primary-solid"
            href={`/client/tournaments/${id}/bracket`}
            style={{
              padding: "0.85rem 1.35rem",
              fontSize: "1.05rem",
              fontWeight: 700,
              justifySelf: "start",
              width: "fit-content",
            }}
          >
            대진표 관리
          </Link>
        ) : (
          <span
            className="ui-btn-primary-solid"
            aria-disabled
            style={{
              padding: "0.85rem 1.35rem",
              fontSize: "1.05rem",
              fontWeight: 700,
              justifySelf: "start",
              width: "fit-content",
              opacity: 0.5,
              cursor: "not-allowed",
              pointerEvents: "none",
              boxShadow: "none",
            }}
          >
            대진표 관리
          </span>
        )}
      </section>

      <section className="v3-stack" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h2 className="v3-h2" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800 }}>
          참가신청 현황
        </h2>
        <ClientTournamentParticipantsApplicationsBlock
          tournamentId={id}
          initialEntries={entries}
          participantCountSummary={participantCountSummary}
          selected={selected}
          filterBaseHref={filterBaseHref}
        />
      </section>
    </main>
  );
}
