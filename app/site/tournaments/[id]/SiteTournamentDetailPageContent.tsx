import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById, getTournamentByIdForPublicSitePage } from "../../../../lib/surface-read";
import { countApprovedApplicationsByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-applications";
import { getLatestBracketByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-brackets";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import SiteTournamentDetailSections from "./site-tournament-detail-sections";

export default async function SiteTournamentDetailPageContent({ id }: { id: string }) {
  const tournament = await getTournamentByIdForPublicSitePage(id);
  if (!tournament) {
    notFound();
  }

  const confirmedParticipantCount = await countApprovedApplicationsByTournamentIdFirestore(id);

  const latestBracket = await getLatestBracketByTournamentIdFirestore(id);
  const showLiveBracketEmbed =
    Boolean(latestBracket) &&
    (tournament.statusBadge === "마감" ||
      tournament.statusBadge === "진행중" ||
      tournament.statusBadge === "종료");

  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const applyHref = session
    ? `/site/tournaments/${id}/apply`
    : `/login?next=${encodeURIComponent(`/site/tournaments/${id}/apply`)}`;

  return (
    <SiteTournamentDetailSections
      tournament={tournament}
      applyHref={applyHref}
      listBackHref="/site/tournaments"
      outlinePdfFileKind={outlinePdfFileKind}
      detailLayout="site"
      showLiveBracketEmbed={showLiveBracketEmbed}
      confirmedParticipantCount={confirmedParticipantCount}
    />
  );
}
