/** 사이트 정적 클럽 카탈로그 타입(항목은 비어 있음 — 실데이터는 Firestore). */
export type SiteVenueCatalogEntry = {
  id: string;
  name: string;
  region: string;
  type: string;
  /** 근처당구장 거리순용(기본 진입 시 계산하지 않음, 동의 후에만 사용) */
  lat?: number;
  lng?: number;
};

/** 정적 샘플 제거 — 클럽 노출은 Firestore 승인·게시 사업장만 사용한다. */
export const SITE_VENUES: SiteVenueCatalogEntry[] = [];

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
