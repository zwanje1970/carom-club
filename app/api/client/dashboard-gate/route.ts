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

async function getAuthorizedClientContext(): Promise<{
  userId: string;
  org: Awaited<ReturnType<typeof resolveClientOrganizationForDashboardPolicy>>;
} | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user || user.role !== "CLIENT") return null;
  if (user.status === "SUSPENDED" || user.status === "DELETED") return null;

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") return null;

  const org = await resolveClientOrganizationForDashboardPolicy(user.id);
  if (org?.status === "SUSPENDED" || org?.status === "EXPELLED") return null;

  return { userId: user.id.trim(), org };
}

function gateJson(body: ClientDashboardGateJson) {
  return NextResponse.json(body);
}

export async function GET() {
  const context = await getAuthorizedClientContext();
  if (!context) {
    return NextResponse.json({ ok: false as const, error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const hasOrgSetup = Boolean(context.org?.setupCompleted);
    if (!hasOrgSetup) {
      return gateJson({
        hasOrgSetup: false,
        hasAnyTournament: false,
        firstTournamentId: "",
        hasPublishedCard: false,
      });
    }

    const tournamentPresence = await findClientDashboardFirstTournamentIdForUser(context.userId);
    const firstTournamentId = tournamentPresence.firstTournamentId.trim();
    if (!tournamentPresence.hasAnyTournament || !firstTournamentId) {
      return gateJson({
        hasOrgSetup: true,
        hasAnyTournament: false,
        firstTournamentId: "",
        hasPublishedCard: false,
      });
    }

    const hasPublishedCard = await someTournamentHasActivePublishedCard([firstTournamentId]);
    return gateJson({
      hasOrgSetup: true,
      hasAnyTournament: true,
      firstTournamentId,
      hasPublishedCard,
    });
  } catch (e) {
    console.error("[api/client/dashboard-gate]", e);
    return NextResponse.json(
      { ok: false as const, error: "대시보드 게이트 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}
