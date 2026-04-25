import { getSiteVenuesBoardRows } from "../../../lib/server/dev-store";
import SiteVenuesBoard from "./SiteVenuesBoard";

export const dynamic = "force-dynamic";

export default async function SiteVenuesPage() {
  const rows = await getSiteVenuesBoardRows();
  return <SiteVenuesBoard initialRows={rows} />;
}
