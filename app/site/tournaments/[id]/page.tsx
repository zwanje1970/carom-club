import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { outlineFileKindFromAsset, outlinePdfIdFromPublicUrl } from "../../../../lib/outline-pdf-helpers";
import { getOutlinePdfAssetById } from "../../../../lib/surface-read";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteTournamentDetailSections from "./site-tournament-detail-sections";

export default async function SiteTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentByIdFirestore(id);
  if (!tournament) {
    notFound();
  }

  const outlinePdfId = outlinePdfIdFromPublicUrl(tournament.outlinePdfUrl);
  const outlinePdfAsset = outlinePdfId ? await getOutlinePdfAssetById(outlinePdfId) : null;
  const outlinePdfFileKind = outlineFileKindFromAsset(outlinePdfAsset);

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const applyHref = session
    ? `/site/tournaments/${id}/apply`
    : `/login?next=${encodeURIComponent(`/site/tournaments/${id}/apply`)}`;

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">대회상세</span>}>
      <section className="site-site-gray-main v3-stack">
        <SiteTournamentDetailSections
          tournament={tournament}
          applyHref={applyHref}
          listBackHref="/site/tournaments"
          outlinePdfFileKind={outlinePdfFileKind}
          detailLayout="site"
        />
      </section>
    </SiteShellFrame>
  );
}
