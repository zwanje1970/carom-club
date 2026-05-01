import {
  parseCommunityPostBodySegmentsWithSizes,
  type CommunityPostBodySegment,
} from "../community-post-content-images";
import {
  SITE_PUBLIC_DETAIL_IMAGE_VARIANT_PREF,
  resolveSiteProofImageUrlWithVariantPreference,
} from "../site-image-list-thumbnail";
import { buildSitePublicImageUrl, loadProofImageAssetsList } from "./platform-backing-store";

/** 공개 게시글 상세: 증빙 `/site-images/...`만 메타 기준으로 정리, 외부 URL은 유지 */
export async function parseCommunityPostBodyForPublicSiteDetail(
  content: string,
  fallbackImageUrls: string[],
  sizeLevels: number[],
): Promise<{
  segments: CommunityPostBodySegment[];
  tailImages: { url: string; sizeLevel: number }[];
}> {
  const base = parseCommunityPostBodySegmentsWithSizes(content, fallbackImageUrls, sizeLevels);
  const proofAssets = await loadProofImageAssetsList();
  const byId = new Map(proofAssets.map((a) => [a.id, a]));
  const mapUrl = (url: string) =>
    resolveSiteProofImageUrlWithVariantPreference(url, byId, buildSitePublicImageUrl, SITE_PUBLIC_DETAIL_IMAGE_VARIANT_PREF) ??
    "";
  return {
    segments: base.segments.map((seg) =>
      seg.kind === "text" ? seg : { ...seg, url: mapUrl(seg.url) },
    ),
    tailImages: base.tailImages.map((item) => ({ ...item, url: mapUrl(item.url) })),
  };
}
