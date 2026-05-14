import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import { resolveCanonicalUserIdForAuth } from "../../../../../lib/auth/resolve-canonical-user-id-for-auth";
import { getUserById } from "../../../../../lib/platform-api";
import { listTournamentApplicationsByUserIdFirestore } from "../../../../../lib/server/firestore-tournament-applications";
import { getTournamentTitleDateFieldsByIdsFirestore } from "../../../../../lib/server/firestore-tournaments";
import { listActiveBracketsForTournamentResultsFirestore } from "../../../../../lib/server/firestore-tournament-brackets";
import { buildDetailedResultsBundleFromBrackets, pickPlayerBlock } from "../../../../../lib/tournament-detailed-results";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const viewerId = await resolveCanonicalUserIdForAuth(session.userId);

  const applications = await listTournamentApplicationsByUserIdFirestore(user.id);
  const approvedTournamentIds = [
    ...new Set(
      applications.filter((a) => a.status === "APPROVED").map((a) => a.tournamentId.trim()).filter(Boolean),
    ),
  ];

  if (approvedTournamentIds.length === 0) {
    return NextResponse.json({ tournaments: [] });
  }

  const meta = await getTournamentTitleDateFieldsByIdsFirestore(approvedTournamentIds);

  const tournaments: Array<{
    tournamentId: string;
    tournamentTitle: string;
    dateLine: string;
    player: NonNullable<ReturnType<typeof pickPlayerBlock>>;
  }> = [];

  for (const tournamentId of approvedTournamentIds) {
    const brackets = await listActiveBracketsForTournamentResultsFirestore(tournamentId);
    const bundle = buildDetailedResultsBundleFromBrackets(brackets);
    const player = pickPlayerBlock(bundle, viewerId);
    if (!player || player.rows.length === 0) continue;
    const m = meta.get(tournamentId);
    tournaments.push({
      tournamentId,
      tournamentTitle: m?.title?.trim() || "대회",
      dateLine: (m?.date ?? "").trim(),
      player,
    });
  }

  tournaments.sort((a, b) => {
    const ad = a.dateLine || "";
    const bd = b.dateLine || "";
    if (ad !== bd) return bd.localeCompare(ad);
    return b.tournamentTitle.localeCompare(a.tournamentTitle, "ko");
  });

  return NextResponse.json({ tournaments });
}
