import { getSiteVenuesBoardRows } from "../../../lib/surface-read";
import { Suspense } from "react";
import SiteVenuesBoard from "./SiteVenuesBoard";
import SiteListPageSkeleton from "../components/SiteListPageSkeleton";

export const dynamic = "force-dynamic";

export default function SiteVenuesPage() {
  return (
    <Suspense fallback={<SiteListPageSkeleton brandTitle="클럽안내" auxiliaryLabel="당구장 목록을 불러오는 중입니다." listRows={5} />}>
      <SiteVenuesPageContent />
    </Suspense>
  );
}

async function SiteVenuesPageContent() {
  const rows = await getSiteVenuesBoardRows();
  return <SiteVenuesBoard initialRows={rows} />;
}
