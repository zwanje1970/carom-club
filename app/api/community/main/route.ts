import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const DEFAULT_TAKE = 10;

/** 커뮤니티 메인: 게시판 목록 + 인기글(오늘/주간/추천많은/댓글많은) + 최신글 */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take")) || DEFAULT_TAKE, 20);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const hiddenFilter = { isHidden: false };

  const [boards, todayPosts, weekPosts, mostLikedPosts, mostCommentPosts, latestPosts] = await Promise.all([
    prisma.communityBoard.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    }),
    prisma.communityPost.findMany({
      where: { ...hiddenFilter, createdAt: { gte: todayStart } },
      orderBy: { viewCount: "desc" },
      take,
      select: {
        id: true,
        title: true,
        viewCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.communityPost.findMany({
      where: { ...hiddenFilter, createdAt: { gte: weekStart } },
      orderBy: { viewCount: "desc" },
      take,
      select: {
        id: true,
        title: true,
        viewCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: { likes: { _count: "desc" } },
      take,
      select: {
        id: true,
        title: true,
        viewCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: { comments: { _count: "desc" } },
      take,
      select: {
        id: true,
        title: true,
        viewCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: { createdAt: "desc" },
      take: take * 2,
      select: {
        id: true,
        title: true,
        viewCount: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
  ]);

  const format = (p: { id: string; title: string; viewCount: number; createdAt: Date; board: { slug: string; name: string }; author: { name: string }; _count: { likes: number; comments: number } }) => ({
    id: p.id,
    title: p.title,
    authorName: p.author.name,
    likeCount: p._count.likes,
    commentCount: p._count.comments,
    viewCount: p.viewCount,
    createdAt: p.createdAt.toISOString(),
    boardSlug: p.board.slug,
    boardName: p.board.name,
  });

  return NextResponse.json({
    boards,
    popular: {
      today: todayPosts.map(format),
      weekly: weekPosts.map(format),
      mostLiked: mostLikedPosts.map(format),
      mostComments: mostCommentPosts.map(format),
    },
    latest: latestPosts.map(format),
  });
}
