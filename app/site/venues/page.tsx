import { getSiteVenuesBoardRows } from "../../../lib/surface-read";
import { Suspense } from "react";
import SiteVenuesBoard from "./SiteVenuesBoard";
import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";

export const dynamic = "force-dynamic";

export default function SiteVenuesPage() {
  return (
    <Suspense fallback={<SiteDetailShellBodyLoader />}>
      <SiteVenuesPageContent />
    </Suspense>
  );
}

async function SiteVenuesPageContent() {
  const rows = await getSiteVenuesBoardRows().catch((e) => {
    console.error("[site/venues] getSiteVenuesBoardRows failed", e);
    return [] as Awaited<ReturnType<typeof getSiteVenuesBoardRows>>;
  });
  return <SiteVenuesBoard initialRows={rows} />;
}
