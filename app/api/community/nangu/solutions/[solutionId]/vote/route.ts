import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";
import {
  awardSolutionGood,
  awardSolutionBad,
  revokeSolutionGood,
  revokeSolutionBad,
} from "@/lib/community-score-service";
import { getLevelFromScore } from "@/lib/community-level";
import { NanguSolutionVoteType } from "@/generated/prisma";

/** 해법 good/bad 투표. 자기 해법에는 투표 불가. 한 유저당 1회만 (변경 시 이전 취소 후 반영) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ solutionId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { solutionId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { communityScore: true },
  });
  const level = user ? getLevelFromScore(user.communityScore ?? 0) : 1;
  if (level < 2) {
    return NextResponse.json({ error: "투표는 레벨 2 이상부터 가능합니다." }, { status: 403 });
  }

  let body: { vote?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const vote = body.vote === "bad" ? "BAD" : body.vote === "good" ? "GOOD" : null;
  if (!vote) {
    return NextResponse.json({ error: "vote는 good 또는 bad 여야 합니다." }, { status: 400 });
  }
  const hasVotePermission =
    vote === "GOOD"
      ? await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_GOOD)
      : await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_BAD);
  if (!hasVotePermission) {
    return NextResponse.json({ error: "해당 평가 권한이 없습니다." }, { status: 403 });
  }

  const solution = await prisma.nanguSolution.findUnique({
    where: { id: solutionId },
    select: { id: true, authorId: true, goodCount: true, badCount: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }
  if (solution.authorId === session.id) {
    return NextResponse.json({ error: "자신의 해법에는 투표할 수 없습니다." }, { status: 403 });
  }

  const existing = await prisma.nanguSolutionVote.findUnique({
    where: { solutionId_userId: { solutionId, userId: session.id } },
  });

  const prevGood = existing?.vote === NanguSolutionVoteType.GOOD ? 1 : 0;
  const prevBad = existing?.vote === NanguSolutionVoteType.BAD ? 1 : 0;

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.nanguSolutionVote.delete({
        where: { solutionId_userId: { solutionId, userId: session.id } },
      });
      await tx.nanguSolution.update({
        where: { id: solutionId },
        data: {
          goodCount: { decrement: prevGood },
          badCount: { decrement: prevBad },
          voteCount: { decrement: prevGood - prevBad },
        },
      });
    }
    if (!existing || existing.vote !== vote) {
      if (vote === "GOOD") {
        await tx.nanguSolutionVote.create({
          data: { solutionId, userId: session.id, vote: NanguSolutionVoteType.GOOD },
        });
        await tx.nanguSolution.update({
          where: { id: solutionId },
          data: { goodCount: { increment: 1 }, voteCount: { increment: 1 } },
        });
      } else {
        await tx.nanguSolutionVote.create({
          data: { solutionId, userId: session.id, vote: NanguSolutionVoteType.BAD },
        });
        await tx.nanguSolution.update({
          where: { id: solutionId },
          data: { badCount: { increment: 1 }, voteCount: { decrement: 1 } },
        });
      }
    }
  });

  if (prevGood) {
    try {
      await revokeSolutionGood(solution.authorId, solutionId);
    } catch (_) {}
  }
  if (prevBad) {
    try {
      await revokeSolutionBad(solution.authorId, solutionId);
    } catch (_) {}
  }
  if (!existing || existing.vote !== vote) {
    if (vote === "GOOD") {
      try {
        await awardSolutionGood(solution.authorId, solutionId);
      } catch (_) {}
    } else {
      try {
        await awardSolutionBad(solution.authorId, solutionId);
      } catch (_) {}
    }
  }

  return NextResponse.json({ ok: true, vote });
}
