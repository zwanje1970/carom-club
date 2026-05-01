import { extractProofImageIdFromSiteImageUrl } from "./site-proof-image-id";

/** `loadProofImageAssetsList()` 행에서 목록 썸네일 판별에 필요한 필드만 */
export type SiteListThumbnailProofFields = {
  storageW160Url?: string;
  storageW320Url?: string;
  storageW640Url?: string;
  storageOriginalUrl?: string;
};

/**
 * 공개 목록 썸네일 URL: 메타에 없는 id는 null. w160 없고 w320+ 있으면 w320(요청: 목록용).
 * `buildPublicImageUrl`: 보통 `buildSitePublicImageUrl` 전달.
 */
export function resolveSiteListThumbnailFromPosterWithAssetMap(
  posterUrl: string | null | undefined,
  assetsById: ReadonlyMap<string, SiteListThumbnailProofFields>,
  buildPublicImageUrl: (imageId: string, variant: "original" | "w160" | "w320" | "w640") => string,
): string | null {
  if (typeof posterUrl !== "string") return null;
  const trimmed = posterUrl.trim();
  if (!trimmed) return null;
  const id = extractProofImageIdFromSiteImageUrl(trimmed);
  if (!id) return null;
  const asset = assetsById.get(id);
  if (!asset) return null;

  const has160 = Boolean(asset.storageW160Url?.trim());
  const has320 = Boolean(asset.storageW320Url?.trim());
  const has640 = Boolean(asset.storageW640Url?.trim());
  const hasOrig = Boolean(asset.storageOriginalUrl?.trim());

  if (has160) return buildPublicImageUrl(id, "w160");
  if (has320) return buildPublicImageUrl(id, "w320");
  if (has640) return buildPublicImageUrl(id, "w640");
  if (hasOrig) return buildPublicImageUrl(id, "original");
  return buildPublicImageUrl(id, "w160");
}

/** 메인 슬라이드 게시카드(320 계열) */
export const SITE_MAIN_SLIDE_CARD_IMAGE_VARIANT_PREF = ["w320", "w640", "w160", "original"] as const;
/** 상세·본문(640 계열 우선) */
export const SITE_PUBLIC_DETAIL_IMAGE_VARIANT_PREF = ["w640", "w320", "w160", "original"] as const;

export type SiteProofImageVariantPref = "w320" | "w640" | "w160" | "original";

/**
 * 증빙 URL만 메타 검증·변형 폴백. id 추출 불가면 원문 URL 그대로(외부 이미지 등).
 * id는 있으나 메타 없으면 null → 호출부에서 `<img>` 생략.
 */
export function resolveSiteProofImageUrlWithVariantPreference(
  url: string | null | undefined,
  assetsById: ReadonlyMap<string, SiteListThumbnailProofFields>,
  buildPublicImageUrl: (imageId: string, variant: "original" | "w160" | "w320" | "w640") => string,
  preference: readonly SiteProofImageVariantPref[],
): string | null {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  const idRaw = extractProofImageIdFromSiteImageUrl(trimmed);
  if (!idRaw) return trimmed;

  const id = idRaw.trim();
  const asset = assetsById.get(id) ?? assetsById.get(id.toLowerCase());
  if (!asset) return null;

  const has160 = Boolean(asset.storageW160Url?.trim());
  const has320 = Boolean(asset.storageW320Url?.trim());
  const has640 = Boolean(asset.storageW640Url?.trim());
  const hasOrig = Boolean(asset.storageOriginalUrl?.trim());

  const pick = (v: SiteProofImageVariantPref): string | null => {
    if (v === "w160" && has160) return buildPublicImageUrl(id, "w160");
    if (v === "w320" && has320) return buildPublicImageUrl(id, "w320");
    if (v === "w640" && has640) return buildPublicImageUrl(id, "w640");
    if (v === "original" && hasOrig) return buildPublicImageUrl(id, "original");
    return null;
  };

  for (const v of preference) {
    const u = pick(v);
    if (u) return u;
  }
  return buildPublicImageUrl(id, "w160");
}
