"use client";

/** @deprecated import from `../lib/site-geolocation-flow` — 호환용 재export */
export { VENUES_GEO_STORAGE_LAT, VENUES_GEO_STORAGE_LNG } from "../lib/site-geolocation-flow";

/**
 * 예전 `data-distance-trigger` 위임은 제거됨. 위치 요청은 대회/당구장 목록 화면의 거리순 버튼에서만.
 */
export default function SiteVenuesGeolocationNav() {
  return null;
}
