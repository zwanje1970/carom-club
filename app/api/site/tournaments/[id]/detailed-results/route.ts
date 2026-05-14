import { NextResponse } from "next/server";
import { getTournamentByIdFirestore } from "../../../../../../lib/server/firestore-tournaments";
import { listActiveBracketsForTournamentResultsFirestore } from "../../../../../../lib/server/firestore-tournament-brackets";
import { buildDetailedResultsBundleFromBrackets } from "../../../../../../lib/tournament-detailed-results";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const tid = id.trim();
  if (!tid) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) {
    return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  }

  const brackets = await listActiveBracketsForTournamentResultsFirestore(tid);
  const bundle = buildDetailedResultsBundleFromBrackets(brackets);
  const tournamentTitle = tournament.title?.trim() ?? "";

  return NextResponse.json({ bundle, tournamentTitle, statusBadge: tournament.statusBadge });
}
