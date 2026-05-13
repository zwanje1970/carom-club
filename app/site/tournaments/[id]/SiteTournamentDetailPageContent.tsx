import { Suspense } from "react";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById, getTournamentByIdForPublicSitePage } from "../../../../lib/surface-read";
import { countApprovedApplicationsByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-applications";
import { getLatestBracketByTournamentIdFirestore } from "../../../../lib/server/firestore-tournament-brackets";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import SiteDetailShellBodyLoader from "../../components/SiteDetailShellBodyLoader";
import SiteTournamentDetailSections from "./site-tournament-detail-sections";

type BaseProps = {
  id: string;
  tournament: NonNullable<Awaited<ReturnType<typeof getTournamentByIdForPublicSitePage>>>;
  applyHref: string;
};

async function TournamentDetailSupplementSections({ id, tournament, applyHref }: BaseProps) {
  const [confirmedParticipantCount, latestBracket] = await Promise.all([
    countApprovedApplicationsByTournamentIdFirestore(id),
    getLatestBracketByTournamentIdFirestore(id),
  ]);
  const showLiveBracketEmbed =
    Boolean(latestBracket) &&
    (tournament.statusBadge === "마감" ||
      tournament.statusBadge === "진행중" ||
      tournament.statusBadge === "종료");

  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAssetPromise = outlinePdfId ? getOutlinePdfAssetById(outlinePdfId) : Promise.resolve(null);
  const outlinePdfAsset = await outlinePdfAssetPromise;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

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

export default async function SiteTournamentDetailPageContent({ id }: { id: string }) {
  const tournament = await getTournamentByIdForPublicSitePage(id);
  if (!tournament) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const applyHref = session
    ? `/site/tournaments/${id}/apply`
    : `/login?next=${encodeURIComponent(`/site/tournaments/${id}/apply`)}`;

  return (
    <Suspense
      fallback={
        <>
          <SiteTournamentDetailSections
            tournament={tournament}
            applyHref={applyHref}
            listBackHref="/site/tournaments"
            detailLayout="site"
            deferHeavy
          />
          <SiteDetailShellBodyLoader />
        </>
      }
    >
      <TournamentDetailSupplementSections id={id} tournament={tournament} applyHref={applyHref} />
    </Suspense>
  );
}
