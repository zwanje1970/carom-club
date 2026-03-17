/**
 * 커뮤니티 신뢰도 점수 부여 서비스
 * - 점수 이벤트 시 User.communityScore 갱신 + CommunityScoreLog 기록
 */

import { prisma } from "@/lib/db";
import type { PrismaClient } from "@/generated/prisma";

const SCORE = {
  POST_CREATED: 2,
  COMMENT_LIKE_PER_ONE: 1,
  COMMENT_LIKE_CAP_PER_POST: 3,
  SOLUTION_CREATED: 4,
  SOLUTION_GOOD: 1,
  SOLUTION_BAD: -1,
  SOLUTION_ADOPTED: 6,
  ADOPTER_BONUS: 2,
  TOURNAMENT_APPLY: 10,
  TOURNAMENT_CANCEL: -10,
  TOURNAMENT_ATTEND: 10,
} as const;

type ScoreType =
  | "post_created"
  | "comment_like_received"
  | "solution_created"
  | "solution_good"
  | "solution_good_revoked"
  | "solution_bad"
  | "solution_bad_revoked"
  | "solution_adopted"
  | "adopter_bonus"
  | "tournament_apply"
  | "tournament_cancel"
  | "tournament_attend";

async function addScore(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  userId: string,
  type: ScoreType,
  amount: number,
  refType?: string,
  refId?: string
) {
  if (amount === 0) return;
  await tx.communityScoreLog.create({
    data: { userId, type, amount, refType, refId },
  });
  await tx.user.update({
    where: { id: userId },
    data: { communityScore: { increment: amount } },
  });
}

/** 일반 게시글 작성 시 +2점 (공지 제외 일반 게시판) */
export async function awardPostCreated(userId: string, postId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, userId, "post_created", SCORE.POST_CREATED, "post", postId);
  });
}

/**
 * 댓글 좋아요 받음 +1점.
 * - 자기 댓글 좋아요 금지: 호출 전에 comment.authorId !== likerId 검사 필요.
 * - 동일 유저 1회만: DB unique(commentId, userId)로 보장.
 * - 해당 게시글 내 댓글 좋아요 점수는 최대 +3까지만 반영.
 */
export async function awardCommentLikeReceived(
  commentAuthorId: string,
  commentId: string,
  postId: string,
  likerId: string
) {
  if (commentAuthorId === likerId) return;
  await prisma.$transaction(async (tx) => {
    const myCommentIdsInPost = await tx.communityComment.findMany({
      where: { postId, authorId: commentAuthorId },
      select: { id: true },
    });
    const ids = myCommentIdsInPost.map((c) => c.id);
    if (ids.length === 0) return;
    const logs = await tx.communityScoreLog.findMany({
      where: {
        userId: commentAuthorId,
        type: "comment_like_received",
        refType: "comment",
        refId: { in: ids },
      },
      select: { amount: true },
    });
    const currentFromPost = logs.reduce((s, l) => s + l.amount, 0);
    if (currentFromPost >= SCORE.COMMENT_LIKE_CAP_PER_POST) return;
    const toAdd = Math.min(SCORE.COMMENT_LIKE_PER_ONE, SCORE.COMMENT_LIKE_CAP_PER_POST - currentFromPost);
    if (toAdd <= 0) return;
    await addScore(tx, commentAuthorId, "comment_like_received", toAdd, "comment", commentId);
  });
}

/** 좋아요 취소 시 -1점 (이전에 부여했던 점수 회수) */
export async function revokeCommentLikeReceived(commentAuthorId: string, commentId: string) {
  await prisma.$transaction(async (tx) => {
    const log = await tx.communityScoreLog.findFirst({
      where: { userId: commentAuthorId, type: "comment_like_received", refId: commentId },
      orderBy: { createdAt: "desc" },
    });
    if (!log || log.amount <= 0) return;
    await tx.communityScoreLog.create({
      data: { userId: commentAuthorId, type: "comment_like_received", amount: -log.amount, refType: "comment", refId: commentId },
    });
    await tx.user.update({
      where: { id: commentAuthorId },
      data: { communityScore: { decrement: log.amount } },
    });
  });
}

/** 해법 등록 +4점 */
export async function awardSolutionCreated(userId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, userId, "solution_created", SCORE.SOLUTION_CREATED, "solution", solutionId);
  });
}

/** 해법 good +1점 (해법 작성자에게) */
export async function awardSolutionGood(solutionAuthorId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, solutionAuthorId, "solution_good", SCORE.SOLUTION_GOOD, "solution", solutionId);
  });
}

/** 해법 bad -1점 (해법 작성자에게) */
export async function awardSolutionBad(solutionAuthorId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, solutionAuthorId, "solution_bad", SCORE.SOLUTION_BAD, "solution", solutionId);
  });
}

/** bad 투표 취소 시 +1점 복원 */
export async function revokeSolutionBad(solutionAuthorId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, solutionAuthorId, "solution_bad_revoked", 1, "solution", solutionId);
  });
}

/** good 투표 취소 시 -1점 회수 */
export async function revokeSolutionGood(solutionAuthorId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, solutionAuthorId, "solution_good_revoked", -1, "solution", solutionId);
  });
}

/** 해법 채택: 해법 작성자 +6점 */
export async function awardSolutionAdopted(solutionAuthorId: string, solutionId: string, postId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, solutionAuthorId, "solution_adopted", SCORE.SOLUTION_ADOPTED, "solution", solutionId);
  });
}

/** 질문자가 해법 채택 시 질문자(게시글 작성자) +2점 */
export async function awardAdopterBonus(postAuthorId: string, postId: string, solutionId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, postAuthorId, "adopter_bonus", SCORE.ADOPTER_BONUS, "post", postId);
  });
}

/** 시합 참가 신청 +10점 */
export async function awardTournamentApply(userId: string, entryId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, userId, "tournament_apply", SCORE.TOURNAMENT_APPLY, "entry", entryId);
  });
}

/** 참가 취소 -10점 */
export async function revokeTournamentCancel(userId: string, entryId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, userId, "tournament_cancel", SCORE.TOURNAMENT_CANCEL, "entry", entryId);
  });
}

/** 실제 참가 완료(출석) +10점 */
export async function awardTournamentAttend(userId: string, attendanceId: string) {
  await prisma.$transaction(async (tx) => {
    await addScore(tx, userId, "tournament_attend", SCORE.TOURNAMENT_ATTEND, "attendance", attendanceId);
  });
}
