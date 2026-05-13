import { Suspense } from "react";
import { notFound } from "next/navigation";
import SiteShellFrame from "../../components/SiteShellFrame";
import SiteDetailShellBodyLoader from "../../components/SiteDetailShellBodyLoader";
import SiteTournamentDetailPageContent from "./SiteTournamentDetailPageContent";

export const dynamic = "force-dynamic";

export default async function SiteTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = typeof rawId === "string" ? rawId.trim() : "";
  if (!id) notFound();

  return (
    <SiteShellFrame brandTitle={<span className="site-home-brand-ellipsis">대회상세</span>}>
      <section className="site-site-gray-main v3-stack">
        <Suspense fallback={<SiteDetailShellBodyLoader />}>
          <SiteTournamentDetailPageContent id={id} />
        </Suspense>
      </section>
    </SiteShellFrame>
  );
}
