import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById, getUserById } from "../../../../lib/platform-api";
import { getLatestBracketByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-brackets";
import { getTournamentApplicationListCountsFirestore } from "../../../../lib/server/firestore-tournament-applications";
import { listCardSnapshotsByTournamentId } from "../../../../lib/server/platform-backing-store";
import { formatTournamentScheduleLabel } from "../../../../lib/tournament-schedule";
import Link from "next/link";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";
import TournamentManageFeatureCards from "./TournamentManageFeatureCards";
import TournamentOperationalStartStrip from "./TournamentOperationalStartStrip";
import TournamentZonesManageBlock from "./TournamentZonesManageBlock";
import "./tournament-manage-ui.css";

export const dynamic = "force-dynamic";

function divisionLineForSummary(rule: { divisionEnabled: boolean; divisionRulesJson: unknown[] | null }): string {
  if (rule.divisionEnabled && Array.isArray(rule.divisionRulesJson) && rule.divisionRulesJson.length > 0) {
    return `${rule.divisionRulesJson.length}부`;
  }
  return "—";
}

export default async function ClientTournamentManagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const sessionUser = session ? await getUserById(session.userId) : null;

  const [participantCountSummary, latestBracket, cardSnapshots] = await Promise.all([
    getTournamentApplicationListCountsFirestore(id),
    getLatestBracketByTournamentIdFirestore(id),
    listCardSnapshotsByTournamentId(id),
  ]);
  const hasDraftCardSnapshot = cardSnapshots.some((s) => s.isPublished === true && s.isActive === false);
  const scheduleLine = formatTournamentScheduleLabel(tournament);
  const bracketPlanEnabled =
    tournament.statusBadge === "마감" || tournament.statusBadge === "진행중" || tournament.statusBadge === "종료";
  const operationalUnlocked = tournament.statusBadge === "진행중" || tournament.statusBadge === "종료";
  const hasConfirmedBracket = latestBracket !== null;
  const settlementHref = `/client/settlement/${encodeURIComponent(id)}`;

  return (
    <main className="v3-page v3-stack client-tournament-manage">
      <TournamentBadgeCardManageRow
        tournamentId={id}
        initialStatus={tournament.statusBadge}
        hasDraftCardSnapshot={hasDraftCardSnapshot}
        infoCard={{
          title: tournament.title,
          scheduleLine: scheduleLine || null,
          divisionLabel: divisionLineForSummary(tournament.rule),
          maxParticipants: tournament.maxParticipants,
          applicationTotal: participantCountSummary.total,
        }}
      />

      <section className="client-tournament-manage__card client-tournament-manage__card--hub">
        <TournamentOperationalStartStrip
          tournamentId={id}
          statusBadge={tournament.statusBadge}
          hasConfirmedBracket={hasConfirmedBracket}
        />
        <TournamentManageFeatureCards
          tournamentId={id}
          statusBadge={tournament.statusBadge}
          bracketPlanEnabled={bracketPlanEnabled}
          hasConfirmedBracket={hasConfirmedBracket}
          operationalUnlocked={operationalUnlocked}
        />
      </section>

      {tournament.zonesEnabled === true ? (
        <section className="client-tournament-manage__card">
          <TournamentZonesManageBlock
            tournamentId={id}
            zonesEnabled
            tournamentCreatedBy={tournament.createdBy ?? ""}
            viewerRole={sessionUser?.role ?? null}
            viewerCanonicalUserId={viewerId}
            viewerSessionUserId={session?.userId?.trim() ?? ""}
          />
        </section>
      ) : null}

      <section className="client-tournament-manage__card client-tournament-manage__card--settlementFooter" aria-label="정산 관리">
        <h2 className="client-tournament-manage__settlementFooterTitle">정산 관리</h2>
        <p className="v3-muted" style={{ margin: "0 0 0.5rem", fontSize: "0.82rem", lineHeight: 1.45 }}>
          대회 운영 흐름과 별도로 언제든 정산을 입력할 수 있습니다.
        </p>
        <Link prefetch={false} href={settlementHref} className="ui-btn-primary-solid" style={{ textDecoration: "none", display: "inline-flex", fontWeight: 700 }}>
          정산 관리 열기
        </Link>
      </section>
    </main>
  );
}
