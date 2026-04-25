/**
 * 당구장 목록 URL — 거리 좌표·거부 플래그는 URL에 넣지 않음(메모리 전용).
 */
export function buildVenuesListHref(
  searchParams: Record<string, string | string[] | undefined> = {}
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
  next.delete("distanceLat");
  next.delete("distanceLng");
  next.delete("distanceDenied");
  const q = next.toString();
  return q ? `?${q}` : "";
}
