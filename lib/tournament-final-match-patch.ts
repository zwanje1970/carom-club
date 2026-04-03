/**
 * TournamentFinalMatch 공통 PATCH (관리자·클라 콘솔 공용).
 *
 * 레거시 이름은 유지하지만 실제 저장소는 `BracketMatch`를 사용한다.
 */

import type { PrismaClient, BracketMatch } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import { fetchOrImportBracketSnapshotByKind, patchBracketMatchByKind } from "@/lib/bracket-match-service";

export type FinalMatchPatchBody = {
  scoreA?: number;
  scoreB?: number;
  winnerEntryId?: string | null;
  status?: string;
  entryIdA?: string | null;
  entryIdB?: string | null;
  matchVenueId?: string | null;
  /** ISO 8601 또는 null(미정) */
  scheduledStartAt?: string | null;
  hasIssue?: boolean;
  issueNote?: string | null;
};

export type FinalMatchPatchOpts = {
  actorUserId?: string;
  /** false면 COMPLETED 경기의 승자·점수·선수·상태 변경 불가 (운영·메모·경기장·시간만 허용) */
  allowCompletedResultEdit?: boolean;
};

export async function patchTournamentFinalMatch(
  db: PrismaClient,
  tournamentId: string,
  matchId: string,
  body: FinalMatchPatchBody,
  opts?: FinalMatchPatchOpts
): Promise<{ ok: true; match: BracketMatch } | { ok: false; status: number; error: string }> {
  const preferredKind = (await db.bracket.findFirst({
    where: { tournamentId, kind: "FINAL" },
    select: { id: true },
  }))
    ? ("FINAL" as const)
    : ("MAIN" as const);
  const bracket = await fetchOrImportBracketSnapshotByKind(tournamentId, preferredKind);
  if (!bracket) {
    return { ok: false, status: 404, error: "경기를 찾을 수 없습니다." };
  }

  const allowCompleted = opts?.allowCompletedResultEdit !== false;
  const r = await patchBracketMatchByKind(db, tournamentId, bracket.kind as "MAIN" | "FINAL", matchId, body, {
    actorUserId: opts?.actorUserId,
    allowCompletedResultEdit: allowCompleted,
  });
  if (!r.ok) return r;
  return { ok: true, match: r.match };
}

export async function patchTournamentFinalMatchDefault(
  tournamentId: string,
  matchId: string,
  body: FinalMatchPatchBody,
  opts?: FinalMatchPatchOpts
) {
  return patchTournamentFinalMatch(prisma, tournamentId, matchId, body, opts);
}
