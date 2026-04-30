import { extractProofImageIdFromSiteImageUrl } from "./site-proof-image-id";

/** 저장값이 과거 API 경로인 경우 `<img src>`용 `/site-images/{variant}/{id}` 로 정규화 (상세·640 계열 표시용) */
export function resolveSitePosterDisplayUrl(posterUrl: string | null | undefined): string | null {
  if (typeof posterUrl !== "string") return null;
  const trimmed = posterUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/api/site-images/")) {
    const hashless = trimmed.split("#")[0] ?? trimmed;
    const q = hashless.indexOf("?");
    const pathPart = q >= 0 ? hashless.slice(0, q) : hashless;
    const idRaw = pathPart.replace(/^\/api\/site-images\//, "").trim();
    if (idRaw) {
      const id = decodeURIComponent(idRaw);
      const sp = new URLSearchParams(q >= 0 ? hashless.slice(q + 1) : "");
      const vr = sp.get("variant");
      let v =
        vr === "original" || vr === "w160" || vr === "w320" || vr === "w640" ? vr : "w640";
      if (v === "w160") v = "w640";
      return `/site-images/${v}/${encodeURIComponent(id)}`;
    }
  }

  if (trimmed.startsWith("/api/proof-images/")) {
    const idMatch = trimmed.match(/^\/api\/proof-images\/([^/?#]+)/);
    const vMatch = trimmed.match(/[?&]variant=(original|w160|w320|w640)/);
    const id = idMatch?.[1] ? decodeURIComponent(idMatch[1]) : "";
    let v = (vMatch?.[1] as "original" | "w160" | "w320" | "w640" | undefined) ?? "w640";
    if (v === "w160") v = "w640";
    if (id) return `/site-images/${v}/${encodeURIComponent(id)}`;
  }

  if (trimmed.startsWith("/site-images/w160/")) {
    const id = extractProofImageIdFromSiteImageUrl(trimmed);
    if (id) return `/site-images/w640/${encodeURIComponent(id)}`;
  }

  return trimmed;
}

/**
 * 공개 사이트 **목록** 썸네일 전용: 증빙 이미지 id가 있으면 `/site-images/w160/{id}` 만 반환.
 * 320/640/원본으로 대체하지 않음 — 없으면 null(플레이스홀더).
 */
export function resolveSiteImageListThumbnailUrl(posterUrl: string | null | undefined): string | null {
  if (typeof posterUrl !== "string") return null;
  const trimmed = posterUrl.trim();
  if (!trimmed) return null;
  const id = extractProofImageIdFromSiteImageUrl(trimmed);
  if (!id) return null;
  return `/site-images/w160/${encodeURIComponent(id)}`;
}
