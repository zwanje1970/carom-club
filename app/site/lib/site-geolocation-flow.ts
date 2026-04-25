"use client";

/** @deprecated 위치값을 저장하지 않음. 기존 import 호환용 심볼만 유지 */
export const VENUES_GEO_STORAGE_LAT = "carom_site_venues_lat";
export const VENUES_GEO_STORAGE_LNG = "carom_site_venues_lng";

export function hasGeoConsentInSession(): boolean {
  return false;
}

export function getStoredVenueCoords(): { lat: number; lng: number } | null {
  return null;
}

export function persistVenueCoords(_lat: number, _lng: number): void {}

export function clearStoredVenueCoords(): void {}

/** URL·세션 기반 거리순 활성 표시 제거. 호환용으로 항상 false */
export function useDistanceGearArmed(_urlGeoPresent: boolean): boolean {
  return false;
}

/** Text 노드 등으로 target이 Element가 아닐 때 closest용 기준 요소 */
export function eventTargetElement(ev: MouseEvent): Element | null {
  const t = ev.target;
  if (t instanceof Element) return t;
  if (t instanceof Text && t.parentElement) return t.parentElement;
  return null;
}

const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 5000,
  maximumAge: 0,
};

/** 거리순 첫 시도 전 내부 확인 문구(예시 문구 + 확인 안내) */
export const SITE_GEO_PRECURSOR_CONFIRM_MESSAGE =
  "내 주변 대회와 당구장을 거리순으로 보여드리기 위해 현재 위치를 사용합니다.\n\n확인을 누르면 위치를 요청합니다.";

/** 위치 거부·미지원 시 안내(오류 톤 아님) */
export const SITE_GEO_DENIED_USER_MESSAGE =
  "위치 권한이 없어 거리순 정렬을 사용할 수 없습니다. 브라우저 또는 앱 설정에서 위치 권한을 허용해 주세요.";

let locating = false;

/**
 * `getCurrentPosition` 1회. `maximumAge: 0`.
 * 동시 호출 시 두 번째는 null 반환(중복 요청 방지).
 */
export function fetchViewerCoordinatesOnce(): Promise<{ lat: number; lng: number } | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }
  if (!("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  if (locating) {
    return Promise.resolve(null);
  }
  locating = true;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locating = false;
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          resolve(null);
          return;
        }
        resolve({ lat, lng });
      },
      () => {
        locating = false;
        resolve(null);
      },
      GEO_OPTIONS,
    );
  });
}

/** 첫 거리순(메모리에 좌표 없음)일 때만 확인. false면 위치 요청하지 않음 */
export function confirmSiteGeolocationPrecursor(): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(SITE_GEO_PRECURSOR_CONFIRM_MESSAGE);
}
