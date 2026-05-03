import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getTournamentOwnerAccessPreviewById,
  getUserById,
  resolveClientOrganizationForDashboardPolicy,
  tournamentHasActivePublishedCard,
} from "../../../../../lib/platform-api";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const userId = await getAuthorizedClientUserId();
  if (!userId) {
    return NextResponse.json({ ok: false as const, error: "인증이 필요합니다." }, { status: 401 });
  }

  try {
    const u = new URL(request.url);
    const tournamentId = (u.searchParams.get("tournamentId") ?? "").trim();
    if (!tournamentId) {
      return NextResponse.json({ ok: true as const, hasPublishedActiveForSomeTournament: false });
    }

    const preview = await getTournamentOwnerAccessPreviewById(tournamentId);
    if (!preview || preview.createdBy !== userId || preview.status === "DELETED") {
      return NextResponse.json({ ok: true as const, hasPublishedActiveForSomeTournament: false });
    }

    const hasPublishedActiveForSomeTournament = await tournamentHasActivePublishedCard(tournamentId);
    return NextResponse.json({ ok: true as const, hasPublishedActiveForSomeTournament });
  } catch (e) {
    console.error("[api/client/dashboard-summary/published-card-status]", e);
    return NextResponse.json(
      { ok: false as const, error: "게시카드 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}

