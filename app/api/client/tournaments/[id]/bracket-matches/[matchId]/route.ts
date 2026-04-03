import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { assertClientCanMutateTournamentById } from "@/lib/client-tournament-access";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { parseBracketOpsPolicy } from "@/lib/bracket-ops-policy";
import { fetchOrImportBracketSnapshotByKind, patchMainBracketMatch } from "@/lib/bracket-match-service";
import type { FinalMatchPatchBody } from "@/lib/tournament-final-match-patch";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; matchId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }
  const session = await getSession();
  const { id: tournamentId, matchId } = await params;
  const gate = await assertClientCanMutateTournamentById(session, tournamentId);
  if (!gate.ok) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rule = await prisma.tournamentRule.findUnique({
    where: { tournamentId },
    select: { bracketConfig: true },
  });
  const policy = parseBracketOpsPolicy(rule?.bracketConfig);
  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, "MAIN");
  if (!bracket) {
    return NextResponse.json({ error: "대진표가 생성되지 않았습니다." }, { status: 404 });
  }

  let body: FinalMatchPatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const r = await patchMainBracketMatch(prisma, tournamentId, matchId, body, {
    actorUserId: session.id,
    allowCompletedResultEdit: policy.allowBracketCompletedResultEdit,
  });
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json(r.match);
}
