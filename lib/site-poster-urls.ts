/** 저장값이 과거 API 경로인 경우 `<img src>`용 `/site-images/{variant}/{id}` 로 정규화 */
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
      const v = vr === "original" || vr === "w320" || vr === "w640" ? vr : "w640";
      return `/site-images/${v}/${encodeURIComponent(id)}`;
    }
  }

  if (trimmed.startsWith("/api/proof-images/")) {
    const idMatch = trimmed.match(/^\/api\/proof-images\/([^/?#]+)/);
    const vMatch = trimmed.match(/[?&]variant=(original|w320|w640)/);
    const id = idMatch?.[1] ? decodeURIComponent(idMatch[1]) : "";
    const v = (vMatch?.[1] as "original" | "w320" | "w640" | undefined) ?? "w640";
    if (id) return `/site-images/${v}/${encodeURIComponent(id)}`;
  }

  return trimmed;
}
