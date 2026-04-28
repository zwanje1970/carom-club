import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { resolveCanonicalUserIdForAuth } from "../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById } from "../../../../lib/surface-read";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";
import SiteTournamentDetailSections from "../../../site/tournaments/[id]/site-tournament-detail-sections";
import TournamentBadgeCardManageRow from "./TournamentBadgeCardManageRow";

export default async function ClientTournamentManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!tournament) {
    notFound();
  }

  const viewerId = session ? await resolveCanonicalUserIdForAuth(session.userId) : "";
  const canView = Boolean(session && tournament.createdBy === viewerId);
  if (!canView) {
    notFound();
  }

  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  return (
    <main className="v3-page v3-stack">
      <TournamentBadgeCardManageRow tournamentId={id} initialStatus={tournament.statusBadge} />

      <SiteTournamentDetailSections
        tournament={tournament}
        listBackHref="/client/tournaments"
        audience="client"
        outlinePdfFileKind={outlinePdfFileKind}
      />
    </main>
  );
}
