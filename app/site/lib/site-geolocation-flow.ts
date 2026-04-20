"use client";

/** 당구장 거리순·대회 거리순 공유 — sessionStorage 키 */
export const VENUES_GEO_STORAGE_LAT = "carom_site_venues_lat";
export const VENUES_GEO_STORAGE_LNG = "carom_site_venues_lng";

const GEO_KEYS = { lat: "distanceLat", lng: "distanceLng", denied: "distanceDenied" } as const;

let locating = false;

export function getStoredVenueCoords(): { lat: number; lng: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const sLat = sessionStorage.getItem(VENUES_GEO_STORAGE_LAT);
    const sLng = sessionStorage.getItem(VENUES_GEO_STORAGE_LNG);
    if (!sLat || !sLng) return null;
    const lat = Number.parseFloat(sLat);
    const lng = Number.parseFloat(sLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export function persistVenueCoords(lat: number, lng: number): void {
  try {
    sessionStorage.setItem(VENUES_GEO_STORAGE_LAT, String(lat));
    sessionStorage.setItem(VENUES_GEO_STORAGE_LNG, String(lng));
  } catch {
    /* ignore */
  }
}

/** Text 노드 등으로 target이 Element가 아닐 때 closest용 기준 요소 */
export function eventTargetElement(ev: MouseEvent): Element | null {
  const t = ev.target;
  if (t instanceof Element) return t;
  if (t instanceof Text && t.parentElement) return t.parentElement;
  return null;
}

/**
 * 사용자 클릭 시에만 호출. `/site/venues`·`/site/tournaments` 이동 URL에 좌표를 붙인 뒤 navigate.
 * URL에 이미 distanceLat/Lng가 있으면 그대로 이동. 없으면 sessionStorage → geolocation 순.
 */
export function performGeolocationThenNavigate(targetHref: string, navigate: (href: string) => void): void {
  if (typeof window === "undefined") return;

  const base = window.location.origin;
  const url = new URL(targetHref, base);
  const path = url.pathname;
  if (!path.startsWith("/site/venues") && !path.startsWith("/site/tournaments")) {
    navigate(targetHref);
    return;
  }

  if (url.searchParams.get(GEO_KEYS.lat) && url.searchParams.get(GEO_KEYS.lng)) {
    navigate(targetHref);
    return;
  }

  const stored = getStoredVenueCoords();
  if (stored) {
    const u = new URL(targetHref, base);
    u.searchParams.set(GEO_KEYS.lat, String(stored.lat));
    u.searchParams.set(GEO_KEYS.lng, String(stored.lng));
    u.searchParams.delete(GEO_KEYS.denied);
    navigate(u.pathname + u.search + u.hash);
    return;
  }

  if (!("geolocation" in navigator)) {
    const u = new URL(targetHref, base);
    u.searchParams.set(GEO_KEYS.denied, "1");
    u.searchParams.delete(GEO_KEYS.lat);
    u.searchParams.delete(GEO_KEYS.lng);
    navigate(u.pathname + u.search + u.hash);
    return;
  }

  if (locating) return;
  locating = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      locating = false;
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      persistVenueCoords(lat, lng);
      const u = new URL(targetHref, base);
      u.searchParams.set(GEO_KEYS.lat, String(lat));
      u.searchParams.set(GEO_KEYS.lng, String(lng));
      u.searchParams.delete(GEO_KEYS.denied);
      navigate(u.pathname + u.search + u.hash);
    },
    () => {
      locating = false;
      const u = new URL(targetHref, base);
      u.searchParams.set(GEO_KEYS.denied, "1");
      u.searchParams.delete(GEO_KEYS.lat);
      u.searchParams.delete(GEO_KEYS.lng);
      navigate(u.pathname + u.search + u.hash);
    },
    { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 },
  );
}
