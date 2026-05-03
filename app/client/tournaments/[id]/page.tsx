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
import ClientTournamentParticipantsApplicationsBlock from "./ClientTournamentParticipantsApplicationsBlock";
import { parseClientParticipantFilter } from "./client-participant-filter-shared";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";

export const dynamic = "force-dynamic";

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
  const filterBaseHref = `/client/tournaments/${id}`;
  const bracketEnabled = tournament.statusBadge === "마감";

  return (
    <main className="v3-page v3-stack" style={{ gap: 0, paddingTop: 0 }}>
      <header
        style={{
          paddingBottom: "0.55rem",
          marginBottom: "0.45rem",
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
          <div className="v3-stack" style={{ flex: "1 1 14rem", minWidth: 0, gap: 0 }}>
            <h1
              className="v3-h1"
              style={{
                margin: "0.5rem 0 0.25rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}
            >
              {tournament.title}
            </h1>
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
          </div>
          <TournamentBadgeCardManageRow tournamentId={id} initialStatus={tournament.statusBadge} />
        </div>
      </header>

      <section style={{ marginBottom: "0.55rem" }}>
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
          <Link prefetch={false} className="v3-btn" href={`/client/settlement/${encodeURIComponent(id)}`} style={{ padding: "0.4rem 0.65rem", fontSize: "0.88rem" }}>
            정산 관리
          </Link>
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
        </div>
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
