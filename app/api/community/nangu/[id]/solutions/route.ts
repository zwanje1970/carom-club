import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { isDatabaseConfigured } from "@/lib/db-mode";
import type { NanguSolutionData } from "@/lib/nangu-types";
import { getLevelFromScore, getTierName, getTierColor } from "@/lib/community-level";
import { getNanguSolutionAccessState } from "@/lib/nangu-solution-policy.server";

/** 해당 게시글의 해법 목록. 정렬: 채택 → (good−bad) → 작성자 레벨 보정 → 최신순.
 * `?includeData=1`: 난구노트 해법 미리보기용 — id, solutionData, goodCount, badCount, isAccepted 만 (trouble 목록과 유사)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  const { id: postId } = await params;
  const includeData = new URL(request.url).searchParams.get("includeData") === "1";

  const post = await prisma.nanguPost.findUnique({
    where: { id: postId },
    select: { id: true, adoptedSolutionId: true },
  });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  if (includeData) {
    const rawList = await prisma.nanguSolution.findMany({
      where: { postId },
      select: {
        id: true,
        dataJson: true,
        goodCount: true,
        badCount: true,
        createdAt: true,
      },
    });
    const adoptedId = post.adoptedSolutionId ?? undefined;
    const sorted = [...rawList].sort((a, b) => {
      const aAdopted = a.id === adoptedId ? 1 : 0;
      const bAdopted = b.id === adoptedId ? 1 : 0;
      if (bAdopted !== aAdopted) return bAdopted - aAdopted;
      const aNet = (a.goodCount ?? 0) - (a.badCount ?? 0);
      const bNet = (b.goodCount ?? 0) - (b.badCount ?? 0);
      if (bNet !== aNet) return bNet - aNet;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return NextResponse.json(
      sorted.map((s) => {
        let solutionData: Record<string, unknown> | null = null;
        try {
          solutionData = JSON.parse(s.dataJson) as Record<string, unknown>;
        } catch {
          solutionData = null;
        }
        return {
          id: s.id,
          solutionData,
          goodCount: s.goodCount ?? 0,
          badCount: s.badCount ?? 0,
          isAccepted: s.id === adoptedId,
        };
      })
    );
  }

  const solutions = await prisma.nanguSolution.findMany({
    where: { postId },
    select: {
      id: true,
      title: true,
      voteCount: true,
      goodCount: true,
      badCount: true,
      createdAt: true,
      author: { select: { name: true, communityScore: true } },
    },
  });
  const adoptedId = post.adoptedSolutionId ?? undefined;
  const sorted = [...solutions].sort((a, b) => {
    const aAdopted = a.id === adoptedId ? 1 : 0;
    const bAdopted = b.id === adoptedId ? 1 : 0;
    if (bAdopted !== aAdopted) return bAdopted - aAdopted;
    const aNet = (a.goodCount ?? 0) - (a.badCount ?? 0);
    const bNet = (b.goodCount ?? 0) - (b.badCount ?? 0);
    if (bNet !== aNet) return bNet - aNet;
    const aLv = a.author?.communityScore ?? 0;
    const bLv = b.author?.communityScore ?? 0;
    if (bLv !== aLv) return bLv - aLv;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  return NextResponse.json(
    sorted.map((s) => {
      const level = s.author ? Math.min(15, getLevelFromScore(s.author.communityScore ?? 0)) : 1;
      return {
        id: s.id,
        title: s.title,
        authorName: s.author?.name ?? "",
        authorLevel: level,
        authorTierName: getTierName(level),
        authorTierColor: getTierColor(level),
        voteCount: s.voteCount,
        goodCount: s.goodCount ?? 0,
        badCount: s.badCount ?? 0,
        isAdopted: s.id === adoptedId,
        createdAt: s.createdAt,
      };
    })
  );
}

/** 해법 등록. 좌표 기반 data만 저장 (이미지 없음) */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
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
  const { id: postId } = await params;

  const post = await prisma.nanguPost.findUnique({ where: { id: postId }, select: { id: true } });
  if (!post) return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });

  const accessState = await getNanguSolutionAccessState(session);
  if (!accessState.allowed) {
    const error =
      accessState.reason === "level_too_low" && accessState.appliesUserLevelPolicy
        ? `일반회원은 LEVEL ${accessState.minSolutionLevelForUser} 이상부터 해법을 제시할 수 있습니다.`
        : "해법 등록 권한이 없습니다.";
    return NextResponse.json({ error }, { status: 403 });
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

  const dataJson = JSON.stringify(data);
  const solution = await prisma.nanguSolution.create({
    data: {
      postId,
      authorId: session.id,
      title: body.title?.trim() || null,
      comment: body.comment?.trim() || null,
      pathData: data.paths as unknown as Prisma.InputJsonValue,
      settings: (data.settings ?? {}) as unknown as Prisma.InputJsonValue,
      dataJson,
    },
  });
  try {
    const { awardSolutionCreated } = await import("@/lib/community-score-service");
    await awardSolutionCreated(session.id, solution.id);
  } catch (_) {}
  try {
    const { grantUserPoints } = await import("@/lib/activity-point-service");
    await grantUserPoints(session.id, "SOLVER_SOLUTION_CREATE", undefined, {
      refType: "nangu_solution",
      refId: solution.id,
      description: "난구해결사 해법 작성",
      idempotencyKey: `solver_solution_create:nangu:${solution.id}`,
    });
  } catch (_) {}
  return NextResponse.json({
    id: solution.id,
    createdAt: solution.createdAt,
  });
}
