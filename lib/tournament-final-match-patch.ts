/**
 * TournamentFinalMatch 공통 PATCH (관리자·클라 콘솔 공용).
 * READY/진행/완료 흐름, 승자 전파·부전승 연쇄, 완료 경기 수정 정책, 감사 로그.
 */

import type { PrismaClient, TournamentFinalMatch } from "@/generated/prisma";
import type { Prisma } from "@/generated/prisma";
import { clearDownstreamFromMatch } from "@/lib/bracket-downstream";
import {
  onMatchCompletedWithWinner,
  refreshMatchProgressState,
} from "@/lib/tournament-match-progress";
import { prisma } from "@/lib/db";

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

function touchesCompletedMatchCore(body: FinalMatchPatchBody): boolean {
  return (
    body.entryIdA !== undefined ||
    body.entryIdB !== undefined ||
    body.winnerEntryId !== undefined ||
    body.scoreA !== undefined ||
    body.scoreB !== undefined ||
    body.status !== undefined
  );
}

async function writeAuditLog(
  db: PrismaClient,
  row: {
    tournamentId: string;
    matchId: string;
    actorUserId: string;
    action: string;
    summary: Record<string, unknown>;
  }
): Promise<void> {
  try {
    let json = JSON.stringify(row.summary);
    if (json.length > 12000) json = json.slice(0, 12000) + "…";
    const auditDb = db as unknown as {
      tournamentFinalMatchAuditLog: {
        create: (args: {
          data: {
            tournamentId: string;
            matchId: string;
            actorUserId: string;
            action: string;
            summaryJson: string;
          };
        }) => Promise<unknown>;
      };
    };
    await auditDb.tournamentFinalMatchAuditLog.create({
      data: {
        tournamentId: row.tournamentId,
        matchId: row.matchId,
        actorUserId: row.actorUserId,
        action: row.action,
        summaryJson: json,
      },
    });
  } catch {
    // 감사 로그 실패해도 본 처리는 유지
  }
}

export async function patchTournamentFinalMatch(
  db: PrismaClient,
  tournamentId: string,
  matchId: string,
  body: FinalMatchPatchBody,
  opts?: FinalMatchPatchOpts
): Promise<{ ok: true; match: TournamentFinalMatch } | { ok: false; status: number; error: string }> {
  const match = await db.tournamentFinalMatch.findFirst({
    where: { id: matchId, tournamentId },
  });
  if (!match) {
    return { ok: false, status: 404, error: "경기를 찾을 수 없습니다." };
  }

  const allowCompleted = opts?.allowCompletedResultEdit !== false;
  if (match.status === "COMPLETED" && !allowCompleted && touchesCompletedMatchCore(body)) {
    return {
      ok: false,
      status: 403,
      error:
        "완료된 경기 결과 수정이 비활성화되어 있습니다. (bracketConfig.allowBracketCompletedResultEdit=false)",
    };
  }

  if (body.entryIdA !== undefined || body.entryIdB !== undefined) {
    const confirmedIds = await db.tournamentEntry
      .findMany({
        where: { tournamentId, status: "CONFIRMED" },
        select: { id: true },
      })
      .then((rows) => new Set(rows.map((r) => r.id)));
    const check = (id: string | null | undefined) => {
      if (id == null || id === "") return true;
      return confirmedIds.has(id);
    };
    if (body.entryIdA !== undefined && !check(body.entryIdA)) {
      return { ok: false, status: 400, error: "A 슬롯에는 참가확정자만 배치할 수 있습니다." };
    }
    if (body.entryIdB !== undefined && !check(body.entryIdB)) {
      return { ok: false, status: 400, error: "B 슬롯에는 참가확정자만 배치할 수 있습니다." };
    }
  }

  if (body.matchVenueId !== undefined && body.matchVenueId !== null && body.matchVenueId !== "") {
    const v = await db.tournamentMatchVenue.findFirst({
      where: { id: body.matchVenueId, tournamentId },
      select: { id: true },
    });
    if (!v) {
      return { ok: false, status: 400, error: "해당 대회에 속하지 않은 경기장입니다." };
    }
  }

  const effectiveA = body.entryIdA !== undefined ? body.entryIdA : match.entryIdA;
  const effectiveB = body.entryIdB !== undefined ? body.entryIdB : match.entryIdB;

  if (body.status === "IN_PROGRESS") {
    if (match.status === "BYE") {
      return { ok: false, status: 400, error: "부전승 경기는 시작 처리 대상이 아닙니다." };
    }
    if (match.status !== "PENDING" && match.status !== "READY") {
      return { ok: false, status: 400, error: "진행 시작은 대기(PENDING)·준비(READY) 상태에서만 가능합니다." };
    }
    const a = effectiveA != null && effectiveA !== "";
    const b = effectiveB != null && effectiveB !== "";
    if (!a || !b) {
      return { ok: false, status: 400, error: "양쪽 선수가 모두 배정된 경기만 시작할 수 있습니다." };
    }
  }

  if (body.winnerEntryId != null && body.winnerEntryId !== "") {
    const valid = effectiveA === body.winnerEntryId || effectiveB === body.winnerEntryId;
    if (!valid) {
      return { ok: false, status: 400, error: "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다." };
    }
  }
  if (body.scoreA !== undefined && (typeof body.scoreA !== "number" || body.scoreA < 0)) {
    return { ok: false, status: 400, error: "점수는 0 이상이어야 합니다." };
  }
  if (body.scoreB !== undefined && (typeof body.scoreB !== "number" || body.scoreB < 0)) {
    return { ok: false, status: 400, error: "점수는 0 이상이어야 합니다." };
  }

  let scheduledParsed: Date | null | undefined;
  if (body.scheduledStartAt !== undefined) {
    if (body.scheduledStartAt === null || body.scheduledStartAt === "") {
      scheduledParsed = null;
    } else {
      const d = new Date(body.scheduledStartAt);
      if (Number.isNaN(d.getTime())) {
        return { ok: false, status: 400, error: "예정 시각이 올바르지 않습니다." };
      }
      scheduledParsed = d;
    }
  }

  const data: Record<string, unknown> = {};
  if (body.scoreA !== undefined) data.scoreA = body.scoreA;
  if (body.scoreB !== undefined) data.scoreB = body.scoreB;
  if (body.winnerEntryId !== undefined) data.winnerEntryId = body.winnerEntryId || null;
  if (body.status !== undefined) data.status = body.status;
  if (body.winnerEntryId != null && body.winnerEntryId !== "" && body.status === undefined) {
    data.status = "COMPLETED";
  }
  if (body.entryIdA !== undefined) data.entryIdA = body.entryIdA || null;
  if (body.entryIdB !== undefined) data.entryIdB = body.entryIdB || null;
  if (body.matchVenueId !== undefined) data.matchVenueId = body.matchVenueId || null;
  if (scheduledParsed !== undefined) data.scheduledStartAt = scheduledParsed;
  if (body.hasIssue !== undefined) data.hasIssue = body.hasIssue;
  if (body.issueNote !== undefined) data.issueNote = body.issueNote?.trim() ? body.issueNote.trim() : null;

  const slotsChanged =
    (body.entryIdA !== undefined && body.entryIdA !== match.entryIdA) ||
    (body.entryIdB !== undefined && body.entryIdB !== match.entryIdB);
  if (slotsChanged) {
    data.winnerEntryId = null;
    data.scoreA = null;
    data.scoreB = null;
    data.status = "PENDING";
  }

  const winnerCleared =
    body.winnerEntryId !== undefined && (body.winnerEntryId === null || body.winnerEntryId === "");
  if (winnerCleared) {
    data.scoreA = null;
    data.scoreB = null;
    if (data.status === undefined) data.status = "PENDING";
  }

  const updated = await db.tournamentFinalMatch.update({
    where: { id: matchId },
    data: data as Prisma.TournamentFinalMatchUpdateInput,
  });

  if (slotsChanged || winnerCleared) {
    await clearDownstreamFromMatch(tournamentId, matchId);
    if (match.nextMatchId) {
      await refreshMatchProgressState(db, tournamentId, match.nextMatchId);
    }
  } else if (updated.status === "COMPLETED" && updated.winnerEntryId) {
    await onMatchCompletedWithWinner(db, tournamentId, updated);
  }

  await refreshMatchProgressState(db, tournamentId, matchId);

  if (opts?.actorUserId) {
    const action =
      body.status === "IN_PROGRESS" ? "START" : updated.status === "COMPLETED" && body.winnerEntryId ? "RESULT" : "PATCH";
    await writeAuditLog(db, {
      tournamentId,
      matchId,
      actorUserId: opts.actorUserId,
      action,
      summary: { body, resultStatus: updated.status, winnerEntryId: updated.winnerEntryId },
    });
  }

  return { ok: true, match: updated };
}

export async function patchTournamentFinalMatchDefault(
  tournamentId: string,
  matchId: string,
  body: FinalMatchPatchBody,
  opts?: FinalMatchPatchOpts
) {
  return patchTournamentFinalMatch(prisma, tournamentId, matchId, body, opts);
}
