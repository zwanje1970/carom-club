import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { getUserById, reconcileAllTournamentPublishedCardsForMainSlide } from "../../../../../lib/platform-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

/** 플랫폼: 전체 tournamentPublishedCards 메인 비활성 reconcile(고아·삭제·일정 경과). */
export async function POST() {
  const user = await requirePlatformUser();
  if (!user) {
    return NextResponse.json({ error: "플랫폼 관리자만 실행할 수 있습니다." }, { status: 403 });
  }
  const summary = await reconcileAllTournamentPublishedCardsForMainSlide();
  return NextResponse.json({
    ok: true,
    changedRowCount: summary.changedRowCount,
    uniqueTournamentIds: summary.uniqueTournamentIds,
  });
}
