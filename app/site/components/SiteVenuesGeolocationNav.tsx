"use client";

import { useEffect } from "react";

/** 당구장 거리순과 공유 — 이미 허용된 좌표는 탭 클릭 시 재요청 없이 사용 */
export const VENUES_GEO_STORAGE_LAT = "carom_site_venues_lat";
export const VENUES_GEO_STORAGE_LNG = "carom_site_venues_lng";

let locating = false;

const TOURNAMENT_GEO_KEYS = {
  latKey: "distanceLat",
  lngKey: "distanceLng",
  deniedKey: "distanceDenied",
} as const;

/**
 * `a[data-distance-trigger='true']` + `/site/venues` 또는 `/site/tournaments` 링크 클릭 시
 * 좌표가 없으면 getCurrentPosition, 있으면 sessionStorage 로 즉시 이동.
 * 레이아웃 전역에 한 번만 마운트한다.
 */
export default function SiteVenuesGeolocationNav() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      const trigger = el.closest("a[data-distance-trigger='true']");
      if (!(trigger instanceof HTMLAnchorElement)) return;

      let path: string;
      try {
        path = new URL(trigger.href, window.location.origin).pathname;
      } catch {
        return;
      }
      const isVenues = path.startsWith("/site/venues");
      const isTournaments = path.startsWith("/site/tournaments");
      if (!isVenues && !isTournaments) return;

      event.preventDefault();

      let latKey: string;
      let lngKey: string;
      let deniedKey: string;
      if (isTournaments) {
        latKey = TOURNAMENT_GEO_KEYS.latKey;
        lngKey = TOURNAMENT_GEO_KEYS.lngKey;
        deniedKey = TOURNAMENT_GEO_KEYS.deniedKey;
      } else {
        latKey = trigger.dataset.latKey ?? "";
        lngKey = trigger.dataset.lngKey ?? "";
        deniedKey = trigger.dataset.deniedKey ?? "";
        if (!latKey || !lngKey || !deniedKey) {
          window.location.assign(trigger.href);
          return;
        }
      }

      const moveWithDenied = () => {
        const deniedUrl = new URL(trigger.href, window.location.origin);
        deniedUrl.searchParams.set(deniedKey, "1");
        deniedUrl.searchParams.delete(latKey);
        deniedUrl.searchParams.delete(lngKey);
        window.location.assign(deniedUrl.pathname + deniedUrl.search + deniedUrl.hash);
      };

      const navigateWithCoords = (lat: number, lng: number) => {
        const okUrl = new URL(trigger.href, window.location.origin);
        okUrl.searchParams.set(latKey, String(lat));
        okUrl.searchParams.set(lngKey, String(lng));
        okUrl.searchParams.delete(deniedKey);
        window.location.assign(okUrl.pathname + okUrl.search + okUrl.hash);
      };

      const tryStored = (): boolean => {
        let sLat: string | null = null;
        let sLng: string | null = null;
        try {
          sLat = sessionStorage.getItem(VENUES_GEO_STORAGE_LAT);
          sLng = sessionStorage.getItem(VENUES_GEO_STORAGE_LNG);
        } catch {
          return false;
        }
        if (!sLat || !sLng) return false;
        const lat = Number.parseFloat(sLat);
        const lng = Number.parseFloat(sLng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
        navigateWithCoords(lat, lng);
        return true;
      };

      if (tryStored()) return;

      if (!("geolocation" in navigator)) {
        moveWithDenied();
        return;
      }

      if (locating) return;
      locating = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          locating = false;
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          try {
            sessionStorage.setItem(VENUES_GEO_STORAGE_LAT, String(lat));
            sessionStorage.setItem(VENUES_GEO_STORAGE_LNG, String(lng));
          } catch {
            /* ignore */
          }
          navigateWithCoords(lat, lng);
        },
        () => {
          locating = false;
          moveWithDenied();
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
      );
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
