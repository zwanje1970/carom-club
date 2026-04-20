import { getSiteVenuesBoardRows } from "../../../lib/server/dev-store";
import SiteVenuesBoard from "./SiteVenuesBoard";
import { buildVenuesDistanceHref } from "./venues-list-url";

export const dynamic = "force-dynamic";

function parseCoord(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string") return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export default async function SiteVenuesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rows = await getSiteVenuesBoardRows();
  const sp = searchParams ? await searchParams : {};
  const lat = parseCoord(sp.distanceLat);
  const lng = parseCoord(sp.distanceLng);
  const distanceSort =
    lat != null &&
    lng != null &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
      ? { lat, lng }
      : null;

  const rawDenied = sp.distanceDenied;
  const deniedStr = Array.isArray(rawDenied) ? rawDenied[0] : rawDenied;
  const locationDenied = deniedStr === "1" || deniedStr === "true";

  const hasViewerCoordinate = distanceSort != null;
  const distanceButtonHref = `/site/venues${buildVenuesDistanceHref(sp, distanceSort)}`;

  return (
    <SiteVenuesBoard
      initialRows={rows}
      distanceSort={distanceSort}
      locationDenied={locationDenied}
      distanceButtonHref={distanceButtonHref}
      hasViewerCoordinate={hasViewerCoordinate}
    />
  );
}
