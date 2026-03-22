import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { communityListPerfStart } from "@/lib/community-list-perf";

const DEFAULT_TAKE = 10;

const listSelect = {
  id: true,
  title: true,
  viewCount: true,
  createdAt: true,
  likeCount: true,
  commentCount: true,
  board: { select: { slug: true, name: true } },
  author: { select: { name: true } },
} as const;

/** 커뮤니티 메인 API — 목록용 필드만 (본문 제외), 캐시된 likeCount/commentCount */
export async function GET(request: Request) {
  const endPerf = communityListPerfStart("GET /api/community/main");
  if (!isDatabaseConfigured()) {
    endPerf();
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
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    }),
    prisma.communityPost.findMany({
      where: { ...hiddenFilter, createdAt: { gte: todayStart } },
      orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
      take,
      select: listSelect,
    }),
    prisma.communityPost.findMany({
      where: { ...hiddenFilter, createdAt: { gte: weekStart } },
      orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
      take,
      select: listSelect,
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
      take,
      select: listSelect,
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: [{ commentCount: "desc" }, { createdAt: "desc" }],
      take,
      select: listSelect,
    }),
    prisma.communityPost.findMany({
      where: hiddenFilter,
      orderBy: { createdAt: "desc" },
      take: take * 2,
      select: listSelect,
    }),
  ]);

  const format = (p: {
    id: string;
    title: string;
    viewCount: number;
    createdAt: Date;
    likeCount: number;
    commentCount: number;
    board: { slug: string; name: string };
    author: { name: string };
  }) => ({
    id: p.id,
    title: p.title,
    authorName: p.author.name,
    likeCount: p.likeCount,
    commentCount: p.commentCount,
    viewCount: p.viewCount,
    createdAt: p.createdAt.toISOString(),
    boardSlug: p.board.slug,
    boardName: p.board.name,
  });

  endPerf();
  const res = NextResponse.json({
    boards,
    popular: {
      today: todayPosts.map(format),
      weekly: weekPosts.map(format),
      mostLiked: mostLikedPosts.map(format),
      mostComments: mostCommentPosts.map(format),
    },
    latest: latestPosts.map(format),
  });
  res.headers.set("Cache-Control", "public, s-maxage=20, stale-while-revalidate=120");
  return res;
}
