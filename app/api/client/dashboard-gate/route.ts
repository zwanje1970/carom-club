import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  findClientDashboardFirstTournamentIdForUser,
  getClientStatusByUserId,
  getUserById,
  resolveClientOrganizationForDashboardPolicy,
  someTournamentHasActivePublishedCard,
} from "../../../../lib/platform-api";

export const runtime = "nodejs";

type ClientDashboardGateJson = {
  hasOrgSetup: boolean;
  hasAnyTournament: boolean;
  firstTournamentId: string;
  hasPublishedCard: boolean;
};

const SAFE_DASHBOARD_GATE: ClientDashboardGateJson = {
  hasOrgSetup: false,
  hasAnyTournament: false,
  firstTournamentId: "",
  hasPublishedCard: false,
};

async function getAuthorizedClientContext(): Promise<{
  userId: string;
  org: Awaited<ReturnType<typeof resolveClientOrganizationForDashboardPolicy>>;
} | null> {
  let session: ReturnType<typeof parseSessionCookieValue> | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    session = parseSessionCookieValue(raw);
  } catch (e) {
    console.error("[dashboard-gate]", e);
    return null;
  }
  if (!session) return null;

  let user: Awaited<ReturnType<typeof getUserById>> | null = null;
  try {
    user = await getUserById(session.userId);
  } catch (e) {
    console.error("[dashboard-gate]", e);
    return null;
  }
  if (!user || user.role !== "CLIENT") return null;
  if (user.status === "SUSPENDED" || user.status === "DELETED") return null;

  let clientStatus: Awaited<ReturnType<typeof getClientStatusByUserId>> | null = null;
  try {
    clientStatus = await getClientStatusByUserId(user.id);
  } catch (e) {
    console.error("[dashboard-gate]", e);
    return null;
  }
  if (clientStatus !== "APPROVED") return null;

  let org: Awaited<ReturnType<typeof resolveClientOrganizationForDashboardPolicy>> = null;
  try {
    org = await resolveClientOrganizationForDashboardPolicy(user.id);
  } catch (e) {
    console.error("[dashboard-gate]", e);
    org = null;
  }
  if (org?.status === "SUSPENDED" || org?.status === "EXPELLED") return null;

  return { userId: user.id.trim(), org };
}

function gateJson(body: ClientDashboardGateJson) {
  return NextResponse.json(body, { status: 200 });
}

export async function GET() {
  try {
    const context = await getAuthorizedClientContext();
    if (!context) {
      return gateJson(SAFE_DASHBOARD_GATE);
    }

    const hasOrgSetup = Boolean(context.org?.setupCompleted);
    if (!hasOrgSetup) {
      return gateJson({
        hasOrgSetup: false,
        hasAnyTournament: false,
        firstTournamentId: "",
        hasPublishedCard: false,
      });
    }

    let tournamentPresence: Awaited<ReturnType<typeof findClientDashboardFirstTournamentIdForUser>> = {
      hasAnyTournament: false,
      firstTournamentId: "",
    };
    try {
      tournamentPresence = await findClientDashboardFirstTournamentIdForUser(context.userId);
    } catch (e) {
      console.error("[dashboard-gate]", e);
    }
    const firstTournamentId = tournamentPresence.firstTournamentId.trim();
    if (!tournamentPresence.hasAnyTournament || !firstTournamentId) {
      return gateJson({
        hasOrgSetup: true,
        hasAnyTournament: false,
        firstTournamentId: "",
        hasPublishedCard: false,
      });
    }

    let hasPublishedCard = false;
    try {
      hasPublishedCard = await someTournamentHasActivePublishedCard([firstTournamentId]);
    } catch (e) {
      console.error("[dashboard-gate]", e);
    }
    return gateJson({
      hasOrgSetup: true,
      hasAnyTournament: true,
      firstTournamentId,
      hasPublishedCard,
    });
  } catch (e) {
    console.error("[dashboard-gate]", e);
    return gateJson(SAFE_DASHBOARD_GATE);
  }
}
