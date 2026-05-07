import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById } from "../../../../../lib/platform-api";
import {
  getTournamentApplicationListCountsFirestore,
  listTournamentApplicationsListItemsByTournamentIdFirestore,
} from "../../../../../lib/server/firestore-tournament-applications";
import ClientTournamentParticipantsApplicationsBlock from "../ClientTournamentParticipantsApplicationsBlock";
import { parseClientParticipantFilter } from "../client-participant-filter-shared";
import "../tournament-manage-ui.css";

export const dynamic = "force-dynamic";

export default async function ClientTournamentParticipantsPage({
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
  if (!tournament) notFound();

  const viewerId = session ? await resolveCanonicalUserIdForAuth(session.userId) : "";
  const canView = Boolean(session && tournament.createdBy === viewerId);
  if (!canView) notFound();

  const [entries, participantCountSummary] = await Promise.all([
    listTournamentApplicationsListItemsByTournamentIdFirestore(id, { limit: 500 }),
    getTournamentApplicationListCountsFirestore(id),
  ]);
  const selected = parseClientParticipantFilter(f);
  const filterBaseHref = `/client/tournaments/${id}/participants`;

  return (
    <main className="v3-page v3-stack client-tournament-manage client-tournament-manage--participants-subpage">
      <ClientTournamentParticipantsApplicationsBlock
        tournamentId={id}
        tournamentTitle={tournament.title}
        maxParticipants={tournament.maxParticipants}
        initialEntries={entries}
        participantCountSummary={participantCountSummary}
        selected={selected}
        filterBaseHref={filterBaseHref}
        zonesEnabled={tournament.zonesEnabled === true}
        tournamentStatusBadge={tournament.statusBadge}
      />
    </main>
  );
}
