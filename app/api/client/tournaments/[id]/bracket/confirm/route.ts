import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import type { BracketDraftMatchInput } from "../../../../../../../lib/platform-api";
import { getUserById } from "../../../../../../../lib/platform-api";
import {
  createBracketFromDraftFirestore,
  getBracketParticipantSnapshotByIdFirestore,
  getLatestBracketParticipantSnapshotByTournamentIdFirestore,
  type BracketParticipantSnapshotScope,
} from "../../../../../../../lib/server/firestore-tournament-brackets";
import {
  authorizeClientTournamentBracketContext,
  TOURNAMENT_ZONE_FORBIDDEN_ERROR,
  zoneManagerMayAccessZoneId,
} from "../../../../../../../lib/server/tournament-zone-access";

export const runtime = "nodejs";

type ConfirmBracketRequest = {
  snapshotId?: string;
  matches?: BracketDraftMatchInput[];
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const auth = await authorizeClientTournamentBracketContext({ user, tournamentId: id });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.httpStatus });
  }

  const body = (await request.json().catch(() => null)) as ConfirmBracketRequest | null;
  const snapshotId = body?.snapshotId?.trim() ?? "";
  const matches = Array.isArray(body?.matches) ? body.matches : [];
  if (!snapshotId) {
    return NextResponse.json({ error: "snapshotId가 필요합니다." }, { status: 400 });
  }

  const submittedSnapshot = await getBracketParticipantSnapshotByIdFirestore(snapshotId);
  if (!submittedSnapshot || submittedSnapshot.tournamentId !== id) {
    return NextResponse.json({ error: "유효한 대진표 대상자 스냅샷을 찾을 수 없습니다." }, { status: 400 });
  }

  const scope: BracketParticipantSnapshotScope =
    auth.tournament.zonesEnabled === true &&
    typeof submittedSnapshot.zoneId === "string" &&
    submittedSnapshot.zoneId.trim() !== ""
      ? { zoneId: submittedSnapshot.zoneId.trim() }
      : "legacy";

  if (auth.access.kind === "zone_manager" && auth.tournament.zonesEnabled === true) {
    const zid = typeof submittedSnapshot.zoneId === "string" ? submittedSnapshot.zoneId.trim() : "";
    if (!zid || !zoneManagerMayAccessZoneId(auth.access, zid)) {
      return NextResponse.json({ error: TOURNAMENT_ZONE_FORBIDDEN_ERROR }, { status: 403 });
    }
  }

  const latestSnapshot = await getLatestBracketParticipantSnapshotByTournamentIdFirestore(id, scope);
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
