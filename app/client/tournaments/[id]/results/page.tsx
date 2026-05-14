import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { resolveCanonicalUserIdForAuth } from "../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getClientTournamentDetailPreviewById } from "../../../../../lib/platform-api";
import TournamentDetailedResultsFetchClient from "../../../../components/TournamentDetailedResultsFetchClient";
import "../tournament-manage-ui.css";

export const dynamic = "force-dynamic";

export default async function ClientTournamentDetailedResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  const tournament = await getClientTournamentDetailPreviewById(id);
  if (!tournament) notFound();

  const viewerId = session ? await resolveCanonicalUserIdForAuth(session.userId) : "";
  const canView = Boolean(session && tournament.createdBy === viewerId);
  if (!canView) notFound();

  const fetchUrl = `/api/client/tournaments/${encodeURIComponent(id)}/detailed-results`;

  return (
    <main className="v3-page v3-stack client-tournament-manage" style={{ paddingTop: "0.35rem" }}>
      <TournamentDetailedResultsFetchClient fetchUrl={fetchUrl} backHref={`/client/tournaments/${id}`} backLabel="대회 관리로" />
      <p className="v3-muted" style={{ margin: "0.6rem 0 0", fontSize: "0.82rem", lineHeight: 1.45 }}>
        상세입력이 없는 경기는 승·패만 표시됩니다. 통계는 상세가 있는 경기만 반영합니다.
      </p>
    </main>
  );
}
