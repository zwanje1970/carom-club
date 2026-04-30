import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById, type TournamentStatusBadge } from "../../../../../../lib/platform-api";
import { revalidatePublicTournamentCache } from "../../../../../../lib/server/firestore-tournaments";
import { getSharedFirestoreDb } from "../../../../../../lib/server/firestore-users";
import {
  reconcileTournamentPublishedCardsForTournamentId,
  syncActiveTournamentCardSnapshotStatusBadge,
} from "../../../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";
const TOURNAMENT_COLLECTION = "v3_tournaments";
const STATUS_BADGE_OPTIONS: readonly TournamentStatusBadge[] = [
  "모집중",
  "마감임박",
  "마감",
  "대기자모집",
  "예정",
  "종료",
  "초안",
] as const;

function normalizeTournamentStatusBadgeInput(v: unknown): TournamentStatusBadge {
  const s = typeof v === "string" ? v.trim() : "";
  return STATUS_BADGE_OPTIONS.includes(s as TournamentStatusBadge) ? (s as TournamentStatusBadge) : "초안";
}

async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const, reason: "client-role-required" as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const, reason: "client-not-approved" as const };
  }

  return { user, allowed: true as const };
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await getAuthorizedUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "접근 권한이 없습니다.", reason: auth.reason }, { status: 403 });
  }

  const { id } = await context.params;
  const tournamentId = (id ?? "").trim();
  if (!tournamentId) {
    return NextResponse.json({ error: "대회 ID가 필요합니다." }, { status: 400 });
  }
  let body: { statusBadge?: unknown } = {};
  try {
    body = (await request.json()) as { statusBadge?: unknown };
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const statusBadge = normalizeTournamentStatusBadgeInput(body.statusBadge);
  try {
    const db = getSharedFirestoreDb();
    const ref = db.collection(TOURNAMENT_COLLECTION).doc(tournamentId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.error("[api/client/tournaments/[id]/status-badge] PATCH failed", {
        step: "status-badge-write",
        tournamentId,
        message: "tournament document not found",
      });
      return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
    }

    const data = snap.data() as { createdBy?: unknown } | undefined;
    const createdBy = typeof data?.createdBy === "string" ? data.createdBy.trim() : "";
    if (auth.user.role !== "PLATFORM" && createdBy !== auth.user.id) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    await ref.set({ statusBadge }, { merge: true });
    try {
      await syncActiveTournamentCardSnapshotStatusBadge(tournamentId);
    } catch (e) {
      console.warn("[api/client/tournaments/[id]/status-badge] sync main card status failed", e);
    }
    try {
      await reconcileTournamentPublishedCardsForTournamentId(tournamentId);
    } catch (e) {
      console.warn("[api/client/tournaments/[id]/status-badge] reconcile published cards failed", e);
    }
    try {
      const { rebuildSitePublicTournamentListSnapshots } = await import(
        "../../../../../../lib/server/site-public-list-snapshots-kv"
      );
      await rebuildSitePublicTournamentListSnapshots();
    } catch (e) {
      console.warn("[api/client/tournaments/[id]/status-badge] rebuild tournament list snapshots failed", e);
    }
    revalidatePublicTournamentCache(tournamentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/client/tournaments/[id]/status-badge] PATCH failed", {
      step: "status-badge-write",
      tournamentId,
      statusBadge,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "상태 배지 저장 중 오류가 발생했습니다.", code: "STATUS_BADGE_UPDATE_FAILED" },
      { status: 500 }
    );
  }
}
