/**
 * 당구장 목록 URL 쿼리 — 대회안내 `buildTournamentListHref`와 동일한 병합 방식(거리 파라미터만 도메인에 맞게).
 */
export function buildVenuesDistanceHref(
  searchParams: Record<string, string | string[] | undefined>,
  coords: { lat: number; lng: number } | null
): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "distanceLat" || key === "distanceLng" || key === "distanceDenied") continue;
    if (Array.isArray(value)) {
      for (const item of value) next.append(key, item);
    } else if (typeof value === "string") {
      next.set(key, value);
    }
  }
  if (coords) {
    next.set("distanceLat", String(coords.lat));
    next.set("distanceLng", String(coords.lng));
    next.delete("distanceDenied");
  }
  const q = next.toString();
  return q ? `?${q}` : "";
}
