import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById, getUserById } from "../../../../lib/platform-api";
import { getLatestBracketByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-brackets";
import { getTournamentApplicationListCountsFirestore } from "../../../../lib/server/firestore-tournament-applications";
import { formatTournamentScheduleLabel } from "../../../../lib/tournament-schedule";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";
import TournamentManageFeatureCards from "./TournamentManageFeatureCards";
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

  const [participantCountSummary, latestBracket] = await Promise.all([
    getTournamentApplicationListCountsFirestore(id),
    getLatestBracketByTournamentIdFirestore(id),
  ]);
  const scheduleLine = formatTournamentScheduleLabel(tournament);
  const bracketEnabled = tournament.statusBadge === "마감";
  const hasConfirmedBracket = latestBracket !== null;

  return (
    <main className="v3-page v3-stack client-tournament-manage">
      <TournamentBadgeCardManageRow
        tournamentId={id}
        initialStatus={tournament.statusBadge}
        infoCard={{
          title: tournament.title,
          scheduleLine: scheduleLine || null,
          divisionLabel: divisionLineForSummary(tournament.rule),
          maxParticipants: tournament.maxParticipants,
          applicationTotal: participantCountSummary.total,
        }}
      />

      <section className="client-tournament-manage__card client-tournament-manage__card--hub">
        <TournamentManageFeatureCards
          tournamentId={id}
          bracketEnabled={bracketEnabled}
          hasConfirmedBracket={hasConfirmedBracket}
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
    </main>
  );
}
