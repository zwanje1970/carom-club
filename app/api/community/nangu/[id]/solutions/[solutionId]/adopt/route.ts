import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { awardSolutionAdopted, awardAdopterBonus } from "@/lib/community-score-service";

/** 질문자(게시글 작성자)가 해법 채택. 채택 시 해법 작성자 +6점, 질문자 +2점 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: postId, solutionId } = await params;

  const post = await prisma.nanguPost.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true, adoptedSolutionId: true },
  });
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }
  if (post.authorId !== session.id) {
    return NextResponse.json({ error: "질문자만 해법을 채택할 수 있습니다." }, { status: 403 });
  }
  if (post.adoptedSolutionId) {
    return NextResponse.json({ error: "이미 채택된 해법이 있습니다." }, { status: 400 });
  }

  const solution = await prisma.nanguSolution.findUnique({
    where: { id: solutionId, postId },
    select: { id: true, authorId: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.nanguPost.update({
    where: { id: postId },
    data: { adoptedSolutionId: solutionId },
  });

  try {
    await awardSolutionAdopted(solution.authorId, solutionId, postId);
    await awardAdopterBonus(post.authorId, postId, solutionId);
  } catch (_) {}

  return NextResponse.json({ ok: true });
}
