export type ClientDashboardSummaryJson = {
  ok: true;
  hasOrgSetup: boolean;
  /** 당구장 소개(요강) 의미 있는 내용 존재 */
  hasVenueIntro: boolean;
  /** `종료`가 아닌 표시 가능 대회가 1건 이상 */
  hasActiveTournament: boolean;
  /** 활성(종료 아님) 대회 중 메인 게시·활성 카드가 1건 이상 */
  hasPublishedTournamentCard: boolean;
  autoParticipantPushEnabled: boolean;
  policy: {
    annualMembershipVisible: boolean;
    annualMembershipEnforced: boolean;
    membershipState: "NONE" | "ACTIVE" | "EXPIRED";
    membershipType: "NONE" | "ANNUAL";
  };
};
