import { VenuesListWithLocation } from "@/components/venues/VenuesListWithLocation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import { getVenuesListWithCoords } from "@/lib/db-tournaments";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { normalizeSlugs } from "@/lib/normalize-slug";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";
import { logServerTiming } from "@/lib/perf";

async function loadVenuesList(): Promise<
  { id: string; name: string; slug: string; venueCategory?: "daedae_only" | "mixed" | null }[]
> {
  if (!isDatabaseConfigured()) {
    return normalizeSlugs(MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug })));
  }
  try {
    const rows = await getVenuesListWithCoords(150);
    return normalizeSlugs(
      rows.map((r) => ({ id: r.id, name: r.name, slug: r.slug, venueCategory: r.venueCategory }))
    );
  } catch {
    return normalizeSlugs(MOCK_VENUES_LIST.map((v) => ({ id: v.id, name: v.name, slug: v.slug })));
  }
}

/** 공통 데이터(캐시) + 구장 DB를 병렬로 가져와 목록만 렌더 */
export async function VenuesListBlock() {
  const dbStart = Date.now();
  const [{ copy }, venues] = await Promise.all([getCommonPageData("venues"), loadVenuesList()]);
  logServerTiming("fetch_venues", dbStart);

  const c = copy as Record<AdminCopyKey, string>;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-10 sm:px-6 sm:pb-12">
      {venues.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-site-border bg-site-card p-10 text-center">
          <p className="text-gray-500">{getCopyValue(c, "site.venues.empty")}</p>
        </div>
      ) : (
        <VenuesListWithLocation initialVenues={venues} copy={copy} />
      )}
    </div>
  );
}
