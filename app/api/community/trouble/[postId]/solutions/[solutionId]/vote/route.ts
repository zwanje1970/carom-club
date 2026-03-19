import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { TroubleShotSolutionVoteType } from "@/generated/prisma";

/**
 * 해법 GOOD/BAD 투표. 자기 해법에는 투표 불가.
 * 같은 버튼 다시 누르면 취소(토글). 다른 버튼 누르면 기존 취소 후 반영.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string; solutionId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { solutionId } = await params;

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

  const solution = await prisma.troubleShotSolution.findUnique({
    where: { id: solutionId },
    select: { id: true, authorId: true, goodCount: true, badCount: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }
  if (solution.authorId === session.id) {
    return NextResponse.json({ error: "자신의 해법에는 투표할 수 없습니다." }, { status: 403 });
  }

  const existing = await prisma.troubleShotSolutionVote.findUnique({
    where: { solutionId_userId: { solutionId, userId: session.id } },
  });

  const prevGood = existing?.vote === TroubleShotSolutionVoteType.GOOD ? 1 : 0;
  const prevBad = existing?.vote === TroubleShotSolutionVoteType.BAD ? 1 : 0;

  await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.troubleShotSolutionVote.delete({
        where: { solutionId_userId: { solutionId, userId: session.id } },
      });
      await tx.troubleShotSolution.update({
        where: { id: solutionId },
        data: {
          goodCount: { decrement: prevGood },
          badCount: { decrement: prevBad },
          voteCount: { decrement: prevGood - prevBad },
        },
      });
    }
    if (!existing || existing.vote !== vote) {
      const voteEnum = vote === "GOOD" ? TroubleShotSolutionVoteType.GOOD : TroubleShotSolutionVoteType.BAD;
      await tx.troubleShotSolutionVote.create({
        data: { solutionId, userId: session.id, vote: voteEnum },
      });
      await tx.troubleShotSolution.update({
        where: { id: solutionId },
        data:
          vote === "GOOD"
            ? { goodCount: { increment: 1 }, voteCount: { increment: 1 } }
            : { badCount: { increment: 1 }, voteCount: { decrement: 1 } },
      });
    }
  });

  const newVote = !existing || existing.vote !== vote ? vote : null;
  return NextResponse.json({ ok: true, vote: newVote });
}
