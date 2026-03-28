import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getTroubleShotSolutionsForPost } from "@/lib/community-post-detail-server";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

/**
 * 해당 trouble 글의 해법 목록.
 * postId = CommunityPost.id. 정렬: 채택된 해법 최상단, 나머지 최신순.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const { postId } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const troubleShot = await prisma.troubleShotPost.findUnique({
    where: { postId },
    select: { id: true },
  });
  if (!troubleShot) {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }

  const list = await getTroubleShotSolutionsForPost(postId, session);
  return NextResponse.json(list);
}

/**
 * 난구해결(trouble) 글에 해법 등록.
 * postId = CommunityPost.id. TroubleShotPost를 postId로 찾아 TroubleShotSolution 생성.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { postId } = await params;

  const troubleShot = await prisma.troubleShotPost.findUnique({
    where: { postId },
    select: { id: true },
  });
  if (!troubleShot) {
    return NextResponse.json({ error: "해당 난구해결 글을 찾을 수 없습니다." }, { status: 404 });
  }

  const canCreateSolution = await hasPermission(session, PERMISSION_KEYS.SOLVER_SOLUTION_CREATE);
  if (!canCreateSolution) {
    return NextResponse.json({ error: "해법 작성 권한이 없습니다." }, { status: 403 });
  }

  let body: {
    title?: string | null;
    content?: string;
    solutionImageUrl?: string | null;
    solutionData?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  const solutionData = body.solutionData != null && typeof body.solutionData === "object" ? body.solutionData : null;
  if (!content && !solutionData) {
    return NextResponse.json({ error: "해설 또는 해법 데이터를 입력해주세요." }, { status: 400 });
  }

  const solutionDataJson =
    solutionData != null ? JSON.stringify(solutionData) : null;

  const solution = await prisma.troubleShotSolution.create({
    data: {
      troubleShotPostId: troubleShot.id,
      authorId: session.id,
      title: typeof body.title === "string" ? body.title.trim() || null : null,
      content: content || " ",
      solutionImageUrl: typeof body.solutionImageUrl === "string" ? body.solutionImageUrl.trim() || null : null,
      solutionDataJson,
    },
  });

  try {
    const { grantUserPoints } = await import("@/lib/activity-point-service");
    await grantUserPoints(session.id, "SOLVER_SOLUTION_CREATE", undefined, {
      refType: "trouble_solution",
      refId: solution.id,
      description: "난구해결 해법 작성",
      idempotencyKey: `solver_solution_create:trouble:${solution.id}`,
    });
  } catch (_) {}

  return NextResponse.json({
    id: solution.id,
    createdAt: solution.createdAt.toISOString(),
  });
}
