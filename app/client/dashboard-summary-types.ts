import type { TournamentStatusBadge } from "../../lib/server/platform-backing-store";

export type ClientDashboardSummaryTournament = {
  id: string;
  title: string;
  statusBadge: TournamentStatusBadge;
  date: string;
  maxParticipants: number;
};

export type ClientDashboardSummaryJson = {
  ok: true;
  hasOrgSetup: boolean;
  /** 당구장 소개(요강) 의미 있는 내용 존재 */
  hasVenueIntro: boolean;
  hasAnyTournament: boolean;
  /**
   * 최근(대표) 대회 1건 기준 메인 게시·활성 카드 존재 여부.
   * (구 필드명 유지 — 예전 “전체 대회 중 하나라도”와 달리 대표 1건만 본다.)
   */
  hasPublishedActiveForSomeTournament: boolean;
  firstTournamentId: string;
  /** 대시보드 홈에서는 사용하지 않음(빈 배열). 타입·캐시 호환용. */
  recentTournaments: ClientDashboardSummaryTournament[];
  autoParticipantPushEnabled: boolean;
  policy: {
    annualMembershipVisible: boolean;
    annualMembershipEnforced: boolean;
    membershipState: "NONE" | "ACTIVE" | "EXPIRED";
    membershipType: "NONE" | "ANNUAL";
  };
};
