import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import { checkClientFeatureAccessByUserId, getUserById } from "../../../../../../lib/platform-api";
import { listActiveBracketsForTournamentResultsFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { getTournamentOwnerAccessPreviewById } from "../../../../../../lib/server/platform-backing-store";
import { buildDetailedResultsBundleFromBrackets } from "../../../../../../lib/tournament-detailed-results";

export const runtime = "nodejs";

async function requireBracketAccess(tournamentId: string) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { ok: false as const, status: 401, error: "로그인이 필요합니다." };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, status: 401, error: "사용자를 찾을 수 없습니다." };

  const preview = await getTournamentOwnerAccessPreviewById(tournamentId);
  if (!preview) return { ok: false as const, status: 404, error: "대회를 찾을 수 없습니다." };

  if (user.role === "PLATFORM") {
    return { ok: true as const, user };
  }

  if (user.role !== "CLIENT") {
    return { ok: false as const, status: 403, error: "CLIENT + APPROVED 권한이 필요합니다." };
  }

  const gate = await checkClientFeatureAccessByUserId({ userId: user.id, feature: "BRACKET" });
  if (!gate.ok) {
    return { ok: false as const, status: 403, error: gate.error };
  }

  if (preview.createdBy !== user.id) {
    return { ok: false as const, status: 403, error: "본인 대회만 접근할 수 있습니다." };
  }

  return { ok: true as const, user };
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const auth = await requireBracketAccess(tid);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [tournament, brackets] = await Promise.all([getTournamentByIdFirestore(tid), listActiveBracketsForTournamentResultsFirestore(tid)]);

  const bundle = buildDetailedResultsBundleFromBrackets(brackets);
  const tournamentTitle = tournament?.title?.trim() ?? "";

  return NextResponse.json({ bundle, tournamentTitle });
}
