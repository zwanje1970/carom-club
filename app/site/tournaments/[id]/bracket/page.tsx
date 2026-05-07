import Link from "next/link";
import { notFound } from "next/navigation";
import { getTournamentByIdForPublicSitePage } from "../../../../../lib/surface-read";
import { getLatestBracketByTournamentIdFirestore } from "../../../../../lib/server/firestore-tournament-brackets";
import SiteShellFrame from "../../../components/SiteShellFrame";
import SiteTournamentBracketEmbedDynamic from "../site-tournament-bracket-embed-dynamic";

export default async function SiteTournamentBracketPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tournament = await getTournamentByIdForPublicSitePage(id);
  if (!tournament) notFound();

  const statusOk =
    tournament.statusBadge === "마감" || tournament.statusBadge === "진행중" || tournament.statusBadge === "종료";
  if (!statusOk) notFound();

  const latestBracket = await getLatestBracketByTournamentIdFirestore(id);
  if (!latestBracket) notFound();

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">대진표</span>}>
      <section className="site-site-gray-main v3-stack" style={{ padding: "0.75rem" }}>
        <Link prefetch={false} className="secondary-button" href={`/site/tournaments/${id}`} style={{ alignSelf: "flex-start" }}>
          ← 대회 상세
        </Link>
        <SiteTournamentBracketEmbedDynamic tournamentId={id} fastPoll={tournament.statusBadge === "진행중"} />
      </section>
    </SiteShellFrame>
  );
}
