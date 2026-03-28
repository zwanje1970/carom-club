import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { normalizeCueBallType } from "@/lib/billiard-table-constants";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

/** 난구해결사 게시글 목록. 목록에는 해법 이미지 없이 제목·작성자·투표수만 */
export async function GET() {
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

  const list = await prisma.nanguPost.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
      _count: { select: { solutions: true } },
    },
  });

  const posts = await Promise.all(
    list.map(async (p) => {
      const solutions = await prisma.nanguSolution.findMany({
        where: { postId: p.id },
        select: { id: true, title: true, voteCount: true, author: { select: { name: true } }, createdAt: true },
        orderBy: { voteCount: "desc" },
      });
      return {
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: p.createdAt,
        authorName: p.author.name,
        solutionCount: p._count.solutions,
        solutions: solutions.map((s) => ({
          id: s.id,
          title: s.title,
          authorName: s.author.name,
          voteCount: s.voteCount,
          createdAt: s.createdAt,
        })),
      };
    })
  );

  return NextResponse.json(posts);
}

/** 난구해결사 게시글 작성. 공배치는 글쓰기 단계에서만 저장되며 이후 수정 불가 */
export async function POST(request: Request) {
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

  const canCreatePost = await hasPermission(session, PERMISSION_KEYS.COMMUNITY_POST_CREATE);
  if (!canCreatePost) {
    return NextResponse.json({ error: "게시글 작성 권한이 없습니다." }, { status: 403 });
  }

  let body: {
    title: string;
    content: string;
    ballPlacement: { redBall: { x: number; y: number }; yellowBall: { x: number; y: number }; whiteBall: { x: number; y: number }; cueBall?: unknown };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const content = (body.content ?? "").trim();
  if (!title) return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
  if (!body.ballPlacement) return NextResponse.json({ error: "공 배치가 필요합니다." }, { status: 400 });

  const cueBall = normalizeCueBallType(body.ballPlacement.cueBall);
  const ballPlacementJson = JSON.stringify({
    redBall: body.ballPlacement.redBall,
    yellowBall: body.ballPlacement.yellowBall,
    whiteBall: body.ballPlacement.whiteBall,
    cueBall,
  });

  try {
    const post = await prisma.nanguPost.create({
      data: {
        authorId: session.id,
        title,
        content,
        ballPlacementJson,
      },
    });
    revalidateTag("community-nangu-list");
    return NextResponse.json({ id: post.id, createdAt: post.createdAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("NanguPost")) {
      return NextResponse.json(
        { error: "난구해결사 테이블이 없습니다. 터미널에서 npx prisma migrate deploy 를 실행하거나, Neon SQL Editor에서 prisma/migrations/20260406000000_add_nangu_tables/migration.sql 을 실행하세요." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg || "저장에 실패했습니다." }, { status: 500 });
  }
}
