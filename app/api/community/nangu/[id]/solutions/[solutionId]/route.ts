import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { NanguSolutionData } from "@/lib/nangu-types";

/** 본인 해법 수정 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; solutionId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const { id: postId, solutionId } = await params;

  const solution = await prisma.nanguSolution.findFirst({
    where: { id: solutionId, postId },
    select: { id: true, authorId: true },
  });
  if (!solution) {
    return NextResponse.json({ error: "해법을 찾을 수 없습니다." }, { status: 404 });
  }
  if (solution.authorId !== session.id) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { title?: string | null; comment?: string | null; data: NanguSolutionData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const data = body.data;
  if (!data || typeof data.isBankShot !== "boolean") {
    return NextResponse.json({ error: "해법 데이터가 필요합니다." }, { status: 400 });
  }
  if (!Array.isArray(data.paths)) {
    return NextResponse.json({ error: "경로(paths)가 필요합니다." }, { status: 400 });
  }

  await prisma.nanguSolution.update({
    where: { id: solutionId },
    data: {
      title: body.title?.trim() || null,
      comment: body.comment?.trim() || null,
      dataJson: JSON.stringify(data),
    },
  });

  return NextResponse.json({ ok: true });
}
