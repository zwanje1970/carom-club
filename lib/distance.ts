/**
 * Haversine 거리(km). 위도·경도 두 점 간 대권 거리.
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number | null {
  if (lat2 == null || lon2 == null || Number.isNaN(lat2) || Number.isNaN(lon2)) {
    return null;
  }
  const R = 6371; // Earth radius km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 거리(km)를 "1.2km" 형태로 포맷 (1km 미만은 소수점 1자리) */
export function formatDistanceKm(km: number | null | undefined): string | null {
  if (km == null || km < 0) return null;
  if (km < 1) return `${(km * 1000).toFixed(0)}m`;
  return `${km.toFixed(1)}km`;
}
