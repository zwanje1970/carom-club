import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { NanguSolutionData } from "@/lib/nangu-types";

/** 본인 난구해법 수정 */
export async function PATCH(
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
  const { postId, solutionId } = await params;

  const troubleShot = await prisma.troubleShotPost.findUnique({
    where: { postId },
    select: { id: true },
  });
  if (!troubleShot) {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }

  const solution = await prisma.troubleShotSolution.findFirst({
    where: { id: solutionId, troubleShotPostId: troubleShot.id },
    select: { id: true, authorId: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }
  if (solution.authorId !== session.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { content?: string; solutionData?: NanguSolutionData | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const solutionData = body.solutionData != null && typeof body.solutionData === "object" ? body.solutionData : null;
  if (!content && !solutionData) {
    return NextResponse.json({ error: "내용 또는 해법 데이터가 필요합니다." }, { status: 400 });
  }

  const solutionDataJson = solutionData != null ? JSON.stringify(solutionData) : null;

  await prisma.troubleShotSolution.update({
    where: { id: solutionId },
    data: {
      content,
      solutionDataJson,
    },
  });

  return NextResponse.json({ ok: true });
}
