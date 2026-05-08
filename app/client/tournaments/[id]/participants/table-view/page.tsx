import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById } from "../../../../../../lib/platform-api";
import {
  getTournamentApplicationListCountsFirestore,
  listTournamentApplicationsListItemsByTournamentIdFirestore,
} from "../../../../../../lib/server/firestore-tournament-applications";
import ClientTournamentParticipantsApplicationsBlock from "../../ClientTournamentParticipantsApplicationsBlock";
import "../../tournament-manage-ui.css";

export const dynamic = "force-dynamic";

export default async function ClientTournamentParticipantsTableViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const tournament = await getClientTournamentDetailPreviewById(id);
  if (!tournament) notFound();

  const viewerId = session ? await resolveCanonicalUserIdForAuth(session.userId) : "";
  const canView = Boolean(session && tournament.createdBy === viewerId);
  if (!canView) notFound();

  const [entries, participantCountSummary] = await Promise.all([
    listTournamentApplicationsListItemsByTournamentIdFirestore(id, { limit: 500 }),
    getTournamentApplicationListCountsFirestore(id),
  ]);

  return (
    <main
      data-client-applications-table-fullscreen="1"
      className="v3-page v3-stack client-tournament-manage client-tournament-manage--participants-table-view-page"
    >
      <ClientTournamentParticipantsApplicationsBlock
        tournamentId={id}
        tournamentTitle={tournament.title}
        maxParticipants={tournament.maxParticipants}
        entryQualificationType={tournament.rule.entryQualificationType}
        initialEntries={entries}
        participantCountSummary={participantCountSummary}
        zonesEnabled={tournament.zonesEnabled === true}
        tournamentStatusBadge={tournament.statusBadge}
        variant="fullscreenTable"
      />
    </main>
  );
}
