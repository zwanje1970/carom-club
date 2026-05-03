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
import TournamentManageFeatureCards from "./TournamentManageFeatureCards";
import "./tournament-manage-ui.css";

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

      <section className="client-tournament-manage__card">
        <TournamentManageFeatureCards tournamentId={id} bracketEnabled={bracketEnabled} />
      </section>

      <section className="client-tournament-manage__card client-tournament-manage__card--participants">
        <h2 className="v3-h2 client-tournament-manage__participantsHeading">
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
