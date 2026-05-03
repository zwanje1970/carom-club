import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  clientVenueIntroHasMeaningfulContent,
  getClientDashboardPolicyAndOrganization,
  getClientStatusByUserId,
  getClientVenueIntroByUserId,
  getUserById,
  loadClientDashboardTournamentRollupLightForUser,
  resolveClientOrganizationForDashboardPolicy,
  tournamentHasActivePublishedCard,
} from "../../../../lib/platform-api";
import type {
  ClientDashboardSummaryJson,
  ClientDashboardSummaryTournament,
} from "../../../client/dashboard-summary-types";

export const runtime = "nodejs";

export type { ClientDashboardSummaryJson, ClientDashboardSummaryTournament };

async function getAuthorizedClientUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user || user.role !== "CLIENT") return null;
  if (user.status === "SUSPENDED" || user.status === "DELETED") return null;

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") return null;

  const orgGuard = await resolveClientOrganizationForDashboardPolicy(user.id);
  if (orgGuard?.status === "SUSPENDED" || orgGuard?.status === "EXPELLED") return null;

  return user.id.trim();
}

export async function GET() {
  const userId = await getAuthorizedClientUserId();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const [{ policy, org }, intro, rollupLight] = await Promise.all([
      getClientDashboardPolicyAndOrganization(userId),
      getClientVenueIntroByUserId(userId),
      loadClientDashboardTournamentRollupLightForUser(userId),
    ]);

    const hasVenueIntro = clientVenueIntroHasMeaningfulContent(intro);
    const firstTournamentId = rollupLight.firstTournamentId.trim();
    const hasPublishedActiveForSomeTournament =
      firstTournamentId.length > 0 ? await tournamentHasActivePublishedCard(firstTournamentId) : false;

    const body: ClientDashboardSummaryJson = {
      ok: true,
      hasOrgSetup: Boolean(org?.setupCompleted),
      hasVenueIntro,
      hasAnyTournament: rollupLight.hasAnyTournament,
      hasPublishedActiveForSomeTournament,
      firstTournamentId,
      recentTournaments: [] as ClientDashboardSummaryTournament[],
      autoParticipantPushEnabled: org?.autoParticipantPushEnabled !== false,
      policy: {
        annualMembershipVisible: policy.annualMembershipVisible,
        annualMembershipEnforced: policy.annualMembershipEnforced,
        membershipState: policy.membershipState,
        membershipType: policy.membershipType,
      },
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[api/client/dashboard-summary]", e);
    return NextResponse.json(
      { ok: false as const, error: "대시보드 요약을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
