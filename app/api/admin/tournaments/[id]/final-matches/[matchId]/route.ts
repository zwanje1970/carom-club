import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";
import { parseBracketOpsPolicy } from "@/lib/bracket-ops-policy";
import { canManageTournament, isPlatformAdmin } from "@/lib/permissions";
import { patchTournamentFinalMatch, type FinalMatchPatchBody } from "@/lib/tournament-final-match-patch";

/**
 * 본선 경기 강제 수정. PATCH → canManageTournament
 * - 참가자 강제입력/교체/추가/삭제(entryIdA, entryIdB) 언제든 가능
 * - 경기장·예정시각·이슈 표시 등 클라 콘솔과 동일 필드 지원
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  const { id: tournamentId, matchId } = await params;
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
  if (!tournament) return NextResponse.json({ error: "대회를 찾을 수 없습니다." }, { status: 404 });
  if (!canManageTournament(session, tournament, tournament.organization)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: FinalMatchPatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rule = await prisma.tournamentRule.findUnique({
    where: { tournamentId },
    select: { bracketConfig: true },
  });
  const policy = parseBracketOpsPolicy(rule?.bracketConfig);
  const allowCompleted = isPlatformAdmin(session) || policy.allowBracketCompletedResultEdit;

  const r = await patchTournamentFinalMatch(prisma, tournamentId, matchId, body, {
    actorUserId: session.id,
    allowCompletedResultEdit: allowCompleted,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json(r.match);
}
