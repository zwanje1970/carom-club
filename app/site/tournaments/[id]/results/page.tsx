import { notFound } from "next/navigation";
import { getTournamentByIdForPublicSitePage } from "../../../../../lib/surface-read";
import SiteHeaderListBackLink from "../../../components/SiteHeaderListBackLink";
import SiteShellFrame from "../../../components/SiteShellFrame";
import TournamentDetailedResultsFetchClient from "../../../../components/TournamentDetailedResultsFetchClient";

export const dynamic = "force-dynamic";

export default async function SiteTournamentDetailedResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) notFound();

  if (!(await getTournamentByIdForPublicSitePage(id))) notFound();

  const fetchUrl = `/api/site/tournaments/${encodeURIComponent(id)}/detailed-results`;

  return (
    <SiteShellFrame
      brandLeading={<SiteHeaderListBackLink href={`/site/tournaments/${encodeURIComponent(id)}`} transition="tournaments" />}
      brandTitle={<span className="site-home-brand-ellipsis">대회결과</span>}
    >
      <section className="site-site-gray-main v3-stack">
        <TournamentDetailedResultsFetchClient
          fetchUrl={fetchUrl}
          backHref={`/site/tournaments/${encodeURIComponent(id)}`}
          backLabel="대회 상세로"
        />
        <p className="v3-muted" style={{ margin: "0.6rem 0 0", fontSize: "0.82rem", lineHeight: 1.45 }}>
          상세입력이 없는 경기는 승·패만 표시됩니다. 통계는 상세가 있는 경기만 반영합니다.
        </p>
      </section>
    </SiteShellFrame>
  );
}
