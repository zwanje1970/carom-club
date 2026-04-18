/**
 * 사이트 당구장안내와 동일한 ID·이름 목록.
 * 대회 장소 CTA는 여기 등록된 venue id만 안전하게 연결한다.
 */
export type SiteVenueCatalogEntry = {
  id: string;
  name: string;
  region: string;
  type: string;
  /** 근처당구장 거리순용(기본 진입 시 계산하지 않음, 동의 후에만 사용) */
  lat?: number;
  lng?: number;
};

export const SITE_VENUES: SiteVenueCatalogEntry[] = [
  { id: "venue-1", name: "카롬 강남점", region: "서울 강남", type: "클럽형", lat: 37.498, lng: 127.028 },
  { id: "venue-2", name: "카롬 서초점", region: "서울 서초", type: "대회협력", lat: 37.483, lng: 127.032 },
  { id: "venue-3", name: "카롬 수원점", region: "경기 수원", type: "일반형", lat: 37.264, lng: 127.029 },
];

export function isValidSiteVenueId(id: string): boolean {
  const t = id.trim();
  return t !== "" && SITE_VENUES.some((v) => v.id === t);
}

export function getSiteVenueById(id: string): SiteVenueCatalogEntry | null {
  const t = id.trim();
  return SITE_VENUES.find((v) => v.id === t) ?? null;
}

/** 사이트 당구장 상세 경로 (당구장안내 해당 페이지) */
export function buildSiteVenueDetailPath(venueId: string): string {
  return `/site/venues/${encodeURIComponent(venueId.trim())}`;
}
