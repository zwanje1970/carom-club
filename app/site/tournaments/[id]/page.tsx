import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTournamentById } from "../../../../lib/server/dev-store";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteTournamentDetailSections from "./site-tournament-detail-sections";

export default async function SiteTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await getTournamentById(id);
  if (!tournament) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const applyHref = session ? `/site/tournaments/${id}/apply` : `/login?next=/site/tournaments/${id}`;

  return (
    <SiteShellFrame
      brandTitle={<span className="site-home-brand-ellipsis">{tournament.title}</span>}
    >
      <section className="site-site-gray-main v3-stack">
        <SiteTournamentDetailSections
          tournament={tournament}
          applyHref={applyHref}
          listBackHref="/site/tournaments"
        />
      </section>
    </SiteShellFrame>
  );
}
