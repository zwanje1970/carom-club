/** 클럽안내 목록 스크롤 복원용 — 클라이언트 필터·거리순 상태가 바뀌면 서명이 달라진다 */
export function buildVenuesListScrollSignature(parts: {
  venueType: string;
  feeType: string;
  distanceLat: number | null;
  distanceLng: number | null;
}): string {
  const geo =
    parts.distanceLat != null &&
    parts.distanceLng != null &&
    Number.isFinite(parts.distanceLat) &&
    Number.isFinite(parts.distanceLng)
      ? `geo:${parts.distanceLat.toFixed(3)},${parts.distanceLng.toFixed(3)}`
      : "geo:off";
  return `vt=${parts.venueType}|ft=${parts.feeType}|${geo}`;
}
