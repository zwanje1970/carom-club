import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById } from "../../../../lib/surface-read";
import { getClientTournamentDetailPreviewById } from "../../../../lib/platform-api";
import SiteTournamentDetailSections from "../../../site/tournaments/[id]/site-tournament-detail-sections";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";

export default async function ClientTournamentManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const applyHref = session
    ? `/site/tournaments/${id}/apply`
    : `/login?next=${encodeURIComponent(`/site/tournaments/${id}/apply`)}`;

  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  return (
    <main className="v3-page v3-stack">
      <TournamentBadgeCardManageRow tournamentId={id} initialStatus={tournament.statusBadge} />

      <SiteTournamentDetailSections
        tournament={tournament}
        applyHref={applyHref}
        listBackHref="/client/tournaments"
        audience="client"
        outlinePdfFileKind={outlinePdfFileKind}
      />
    </main>
  );
}
