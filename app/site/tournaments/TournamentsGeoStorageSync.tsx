"use client";

import { useEffect } from "react";
import { VENUES_GEO_STORAGE_LAT, VENUES_GEO_STORAGE_LNG } from "../components/SiteVenuesGeolocationNav";

/** URL에 좌표가 있으면 당구장 거리순과 동일 sessionStorage 에 맞춰 다음 클릭 시 재요청 생략 */
export default function TournamentsGeoStorageSync({
  viewerCoordinate,
}: {
  viewerCoordinate: { lat: number; lng: number } | null;
}) {
  useEffect(() => {
    if (!viewerCoordinate) return;
    try {
      sessionStorage.setItem(VENUES_GEO_STORAGE_LAT, String(viewerCoordinate.lat));
      sessionStorage.setItem(VENUES_GEO_STORAGE_LNG, String(viewerCoordinate.lng));
    } catch {
      /* ignore */
    }
  }, [viewerCoordinate]);
  return null;
}
