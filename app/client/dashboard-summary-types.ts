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
  hasAnyTournament: boolean;
  hasPublishedActiveForSomeTournament: boolean;
  firstTournamentId: string;
  recentTournaments: ClientDashboardSummaryTournament[];
  autoParticipantPushEnabled: boolean;
  policy: {
    annualMembershipVisible: boolean;
    annualMembershipEnforced: boolean;
    membershipState: "NONE" | "ACTIVE" | "EXPIRED";
    membershipType: "NONE" | "ANNUAL";
  };
};
