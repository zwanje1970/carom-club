import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../../lib/auth/session";
import { checkClientFeatureAccessByUserId, getUserById } from "../../../../../../../lib/platform-api";
import {
  createBracketParticipantSnapshotFirestore,
  getLatestBracketParticipantSnapshotByTournamentIdFirestore,
} from "../../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentOwnerAccessPreviewById } from "../../../../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

async function requireApprovedClientOwner(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };
  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await checkClientFeatureAccessByUserId({ userId: user.id, feature: "BRACKET" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }

  const preview = await getTournamentOwnerAccessPreviewById(tournamentId);
  if (!preview) {
    return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };
  }
  if (preview.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }

  return { ok: true as const, user };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireApprovedClientOwner(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const snapshot = await getLatestBracketParticipantSnapshotByTournamentIdFirestore(id);
  return NextResponse.json({ snapshot: snapshot ?? null });
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const auth = await requireApprovedClientOwner(id);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await createBracketParticipantSnapshotFirestore({ tournamentId: id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}
