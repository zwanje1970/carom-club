"use client";

import { useCallback, useEffect, useState } from "react";

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
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("carom-site-distance-geo"));
    }
  } catch {
    /* ignore */
  }
}

/** 공개 사이트 이탈 시 호출 — 다음 방문 시 거리순·주변클럽 탭에서만 다시 위치 확인 */
export function clearStoredVenueCoords(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(VENUES_GEO_STORAGE_LAT);
    sessionStorage.removeItem(VENUES_GEO_STORAGE_LNG);
    window.dispatchEvent(new Event("carom-site-distance-geo"));
  } catch {
    /* ignore */
  }
}

/**
 * 거리순 UI(빨강=활성): 현재 URL에 좌표가 있거나, 한쪽에서 저장한 세션 좌표가 있으면 대회·클럽 둘 다 활성으로 본다.
 */
export function useDistanceGearArmed(urlGeoPresent: boolean): boolean {
  const compute = useCallback(
    () => urlGeoPresent || (typeof window !== "undefined" && getStoredVenueCoords() != null),
    [urlGeoPresent],
  );

  const [armed, setArmed] = useState(urlGeoPresent);

  useEffect(() => {
    setArmed(compute());
  }, [compute]);

  useEffect(() => {
    const refresh = () => setArmed(compute());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("carom-site-distance-geo", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("carom-site-distance-geo", refresh);
    };
  }, [compute]);

  return armed;
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
 * 세션에 좌표가 있으면 같은 공개 사이트 방문 동안 재사용(동의 재요청 없음). 없을 때만 geolocation 조회.
 * 공개 사이트(`/`, `/site/*`)를 벗어나면 `clearStoredVenueCoords`로 세션이 비워진다.
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
