/**
 * App(non-api) 엔터티/도메인 타입(구현은 platform-backing-store와 동기).
 * 구체 정의는 3/3에서 lib/server 정리와 함께 한 곳으로 옮길 수 있음.
 */
export type {
  ClientApplication,
  CommunityPostListItem,
  OutlinePdfAsset,
  SiteCommunityBoardKey,
  SiteCommunityConfig,
  SiteLayoutMenuItem,
  Tournament,
  TournamentApplication,
  TournamentApplicationListItem,
  TournamentDivisionRuleRow,
  TournamentStatusBadge,
} from "../server/platform-backing-store";

export type { SiteTournamentListSnapshot, SiteVenueListSnapshot } from "./site-public-list-snapshots";
