import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** 게시글 상세. 원본 공배치는 항상 보기 전용. 해법 목록은 제목·작성자·투표수만, 상세에서만 dataJson 로드 */
export async function GET(
  _request: Request,
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
  const { id } = await params;

  const post = await prisma.nanguPost.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      title: true,
      content: true,
      ballPlacementJson: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "게시글을 찾을 수 없습니다." }, { status: 404 });
  }

  const solutions = await prisma.nanguSolution.findMany({
    where: { postId: id },
    orderBy: [{ voteCount: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      comment: true,
      dataJson: true,
      voteCount: true,
      createdAt: true,
      author: { select: { name: true } },
    },
  });

  const isAuthor = session.id === post.authorId;

  return NextResponse.json({
    id: post.id,
    authorId: post.authorId,
    authorName: post.author.name,
    title: post.title,
    content: post.content,
    ballPlacement: JSON.parse(post.ballPlacementJson),
    createdAt: post.createdAt,
    isAuthor,
    solutions: solutions.map((s) => ({
      id: s.id,
      title: s.title,
      comment: s.comment,
      data: JSON.parse(s.dataJson),
      voteCount: s.voteCount,
      createdAt: s.createdAt,
      authorName: s.author.name,
    })),
  });
}
