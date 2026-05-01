import type { TournamentStatusBadge } from "../server/platform-backing-store";
import type { VenuePricingType } from "../client-organization-setup-types";

/**
 * 공개 사이트 `/site/tournaments` 목록용 스냅샷(표시 필드만).
 * 상세 페이지·원본 Tournament 엔티티 구조는 변경하지 않는다.
 */
export type SiteTournamentListSnapshot = {
  tournamentId: string;
  title: string;
  statusBadge: TournamentStatusBadge;
  playScaleLabel: string;
  dateLabel: string;
  regionLabel: string;
  /** Tournament `location`에서 카드·목록용 주최장소명만(주소 전체 아님). 없으면 "" */
  venueName: string;
  thumbnail160Url: string | null;
  detailUrl: string;
  sortDate: string;
  createdAt: string;
  isVisibleOnSite: boolean;
  updatedAt: string;
};

/**
 * 공개 사이트 `/site/venues` 목록용 스냅샷(표시 필드만).
 * 상세 페이지·원본 당구장 데이터 구조는 변경하지 않는다.
 */
export type SiteVenueListSnapshot = {
  venueId: string;
  name: string;
  regionLabel: string;
  thumbnail160Url: string | null;
  detailUrl: string;
  lat: number | null;
  lng: number | null;
  /** 목록 필터(유형·요금) 유지용 — 표시 최소화와 별개 */
  venueCategory: "daedae_only" | "mixed";
  pricingType: VenuePricingType;
  catalogTypeLabel: string;
  isVisibleOnSite: boolean;
  updatedAt: string;
};
