import { CACHE_TAG_SITE_VENUES_BOARD_ROWS } from "../cache-tags";
import { revalidateSiteDataTag } from "../revalidate-site-data-tag";

/** 클럽 목록 KV 갱신 후 Next 태그 무효화 */
export async function rebuildVenueListSnapshotsAndRevalidate(): Promise<void> {
  try {
    const { rebuildSitePublicVenueListSnapshots } = await import("./site-public-list-snapshots-kv");
    await rebuildSitePublicVenueListSnapshots();
  } catch (e) {
    console.warn("[revalidate-site-venues-board] rebuild venue list snapshots failed", e);
  }
  revalidateSiteDataTag(CACHE_TAG_SITE_VENUES_BOARD_ROWS);
}
