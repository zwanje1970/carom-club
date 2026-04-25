import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import type { BracketDraftMatchInput } from "../../../../../../../lib/platform-api";
import { checkClientFeatureAccessByUserId, getUserById } from "../../../../../../../lib/platform-api";
import {
  createBracketFromDraftFirestore,
  getLatestBracketParticipantSnapshotByTournamentIdFirestore,
} from "../../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

async function requireBracketAccess(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };

  if (user.role === "PLATFORM") {
    return { ok: true as const, user, tournament };
  }

  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await checkClientFeatureAccessByUserId({ userId: user.id, feature: "BRACKET" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }

  if (tournament.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }

  return { ok: true as const, user, tournament };
}

type ConfirmBracketRequest = {
  snapshotId?: string;
  matches?: BracketDraftMatchInput[];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireBracketAccess(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json().catch(() => null)) as ConfirmBracketRequest | null;
  const snapshotId = body?.snapshotId?.trim() ?? "";
  const matches = Array.isArray(body?.matches) ? body.matches : [];
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshotId가 필요합니다." }, { status: 400 });
  }

  const latestSnapshot = await getLatestBracketParticipantSnapshotByTournamentIdFirestore(id);
  if (!latestSnapshot) {
    return NextResponse.json({ error: "먼저 대진표 대상자 스냅샷을 생성해 주세요." }, { status: 400 });
  }
  if (latestSnapshot.id !== snapshotId) {
    return NextResponse.json(
      { error: "최신 대진표 대상자 스냅샷 기준으로 다시 배정해 주세요." },
      { status: 400 }
    );
  }

  const result = await createBracketFromDraftFirestore({
    tournamentId: id,
    snapshotId,
    matches,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, bracket: result.bracket });
}
