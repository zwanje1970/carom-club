import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

/**
 * 질문자(원글 작성자)가 해법 채택.
 * 한 글당 채택 1개. 새로 채택 시 기존 채택 해제 후 교체.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ postId: string; solutionId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { postId, solutionId } = await params;

  const post = await prisma.communityPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, board: { select: { slug: true } } },
  });
  if (!post || post.board.slug !== "trouble") {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }
  const canAcceptSolution = await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_ACCEPT);
  if (!canAcceptSolution) {
    return NextResponse.json({ error: "해법 채택 권한이 없습니다." }, { status: 403 });
  }
  if (post.authorId !== session.id) {
    return NextResponse.json({ error: "질문자만 해법을 채택할 수 있습니다." }, { status: 403 });
  }

  const troubleShot = await prisma.troubleShotPost.findUnique({
    where: { postId },
    select: { id: true, acceptedSolutionId: true },
  });
  if (!troubleShot) {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }

  const solution = await prisma.troubleShotSolution.findUnique({
    where: { id: solutionId, troubleShotPostId: troubleShot.id },
    select: { id: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.troubleShotPost.update({
      where: { postId },
      data: { acceptedSolutionId: solutionId, isSolved: true },
    });
    if (troubleShot.acceptedSolutionId) {
      await tx.troubleShotSolution.updateMany({
        where: { id: troubleShot.acceptedSolutionId },
        data: { isAccepted: false },
      });
    }
    await tx.troubleShotSolution.update({
      where: { id: solutionId },
      data: { isAccepted: true },
    });
  });

  try {
    const acceptedSolution = await prisma.troubleShotSolution.findUnique({
      where: { id: solutionId },
      select: { authorId: true },
    });
    if (acceptedSolution?.authorId) {
      const { grantUserPoints } = await import("@/lib/activity-point-service");
      await grantUserPoints(acceptedSolution.authorId, "SOLVER_SOLUTION_ACCEPT", undefined, {
        refType: "trouble_solution_accept",
        refId: solutionId,
        description: "난구해결 해법 채택",
        idempotencyKey: `solver_solution_accept:trouble:${solutionId}`,
      });
    }
  } catch (_) {}

  return NextResponse.json({ ok: true });
}
