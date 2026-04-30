/**
 * 사이트 공개 이미지 URL(`/site-images/...`, Storage `proof-images/...` 등)에서 증빙 이미지 UUID 추출.
 */
export function extractProofImageIdFromSiteImageUrl(url: string): string | null {
  const trimmed = url.trim();
  const fromFile = trimmed.match(/\/site-images\/(?:original|w160|w320|w640)\/([^/?#]+)/);
  if (fromFile?.[1]) return decodeURIComponent(fromFile[1]);
  const fromProof = trimmed.match(/\/api\/proof-images\/([^/?]+)/);
  if (fromProof?.[1]) return decodeURIComponent(fromProof[1]);
  const fromSite = trimmed.match(/\/api\/site-images\/([^/?]+)/);
  if (fromSite?.[1]) return decodeURIComponent(fromSite[1]);
  try {
    const u = new URL(trimmed);
    if (u.hostname !== "firebasestorage.googleapis.com") return null;
    const m = u.pathname.match(/\/o\/(.+)$/);
    if (!m?.[1]) return null;
    const decoded = decodeURIComponent(m[1]);
    const parts = decoded.split("/");
    if (parts[0] === "proof-images" && parts.length >= 3 && /^[0-9a-f-]{36}$/i.test(parts[1]!)) {
      return parts[1]!.toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}
