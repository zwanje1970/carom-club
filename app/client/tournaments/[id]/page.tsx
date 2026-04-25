import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getOutlinePdfAssetById, outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/server/dev-store";
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

  const canView = Boolean(session && tournament.createdBy === session.userId);
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
        listBackHref="/client/tournament"
        audience="client"
        outlinePdfFileKind={outlinePdfFileKind}
      />
    </main>
  );
}
