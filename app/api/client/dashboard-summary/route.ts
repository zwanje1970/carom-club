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
} from "../../../../lib/platform-api";
import type {
  ClientDashboardSummaryJson,
  ClientDashboardSummaryTournament,
} from "../../../client/dashboard-summary-types";

export const runtime = "nodejs";

export type { ClientDashboardSummaryJson, ClientDashboardSummaryTournament };

type DashboardSummaryBootstrapHint = {
  userId?: unknown;
  clientStatus?: unknown;
  orgId?: unknown;
  orgStatus?: unknown;
};

function normalizeBootstrapHint(raw: unknown): {
  userId: string;
  clientStatus: "APPROVED" | "PENDING" | "REJECTED" | "";
  orgId: string;
  orgStatus: "ACTIVE" | "SUSPENDED" | "EXPELLED" | "";
} | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as DashboardSummaryBootstrapHint;
  const userId = typeof obj.userId === "string" ? obj.userId.trim() : "";
  if (!userId) return null;
  const clientStatus =
    obj.clientStatus === "APPROVED" || obj.clientStatus === "PENDING" || obj.clientStatus === "REJECTED"
      ? obj.clientStatus
      : "";
  const orgStatus =
    obj.orgStatus === "ACTIVE" || obj.orgStatus === "SUSPENDED" || obj.orgStatus === "EXPELLED"
      ? obj.orgStatus
      : "";
  const orgId = typeof obj.orgId === "string" ? obj.orgId.trim() : "";
  return { userId, clientStatus, orgId, orgStatus };
}

async function getAuthorizedClientUserId(hint: ReturnType<typeof normalizeBootstrapHint>): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user || user.role !== "CLIENT") return null;
  if (user.status === "SUSPENDED" || user.status === "DELETED") return null;
  const uid = user.id.trim();

  // layout에서 전달된 값이 세션 사용자와 일치하면 중복 guard 조회를 생략한다.
  if (
    hint &&
    hint.userId === uid &&
    hint.clientStatus === "APPROVED" &&
    hint.orgStatus !== "SUSPENDED" &&
    hint.orgStatus !== "EXPELLED"
  ) {
    return uid;
  }

  const clientStatus = await getClientStatusByUserId(uid);
  if (clientStatus !== "APPROVED") return null;

  const orgGuard = await resolveClientOrganizationForDashboardPolicy(uid);
  if (orgGuard?.status === "SUSPENDED" || orgGuard?.status === "EXPELLED") return null;

  return uid;
}

async function buildDashboardSummaryResponse(hint: ReturnType<typeof normalizeBootstrapHint>) {
  const userId = await getAuthorizedClientUserId(hint);
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

    const body: ClientDashboardSummaryJson = {
      ok: true,
      hasOrgSetup: Boolean(org?.setupCompleted),
      hasVenueIntro,
      hasAnyTournament: rollupLight.hasAnyTournament,
      /** 대표 대회 게시카드 활성 여부는 후속 경량 API에서 지연 확인 */
      hasPublishedActiveForSomeTournament: false,
      firstTournamentId,
      recentTournaments: rollupLight.recentTournamentsForSummary as ClientDashboardSummaryTournament[],
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

export async function GET() {
  return buildDashboardSummaryResponse(null);
}

export async function POST(request: Request) {
  let hint: ReturnType<typeof normalizeBootstrapHint> = null;
  try {
    const payload = (await request.json()) as unknown;
    hint = normalizeBootstrapHint(payload);
  } catch {
    hint = null;
  }
  return buildDashboardSummaryResponse(hint);
}
