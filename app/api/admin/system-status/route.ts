import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { isPlatformAdmin } from "@/types/auth";

/** 사이트 상태 모니터링: 지표 + 최근 24h 요약 + 최근 대회/게시글/신고 */
export async function GET() {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      todayVisitors: null,
      currentOnline: null,
      todayTournaments: 0,
      totalPosts: 0,
      totalComments: 0,
      totalReports: 0,
      last24h: { tournaments: 0, posts: 0, comments: 0, reports: 0 },
      recentTournaments: [],
      recentPosts: [],
      recentReports: [],
    });
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    todayTournaments,
    totalPosts,
    totalComments,
    totalReports,
    last24hTournaments,
    last24hPosts,
    last24hComments,
    last24hReports,
    recentTournaments,
    recentPosts,
    recentReports,
  ] = await Promise.all([
    prisma.tournament.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.communityPost.count(),
    prisma.communityComment.count(),
    prisma.communityReport.count(),
    prisma.tournament.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.communityPost.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.communityComment.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.communityReport.count({ where: { createdAt: { gte: last24hStart } } }),
    prisma.tournament.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true },
    }),
    prisma.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        createdAt: true,
        board: { select: { slug: true, name: true } },
        author: { select: { name: true } },
      },
    }),
    prisma.communityReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        targetType: true,
        reason: true,
        status: true,
        createdAt: true,
        reporter: { select: { name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    todayVisitors: null as number | null,
    currentOnline: null as number | null,
    todayTournaments,
    totalPosts,
    totalComments,
    totalReports,
    last24h: {
      tournaments: last24hTournaments,
      posts: last24hPosts,
      comments: last24hComments,
      reports: last24hReports,
    },
    recentTournaments: recentTournaments.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.createdAt.toISOString(),
    })),
    recentPosts: recentPosts.map((p) => ({
      id: p.id,
      title: p.title,
      boardSlug: p.board.slug,
      boardName: p.board.name,
      authorName: p.author.name,
      createdAt: p.createdAt.toISOString(),
    })),
    recentReports: recentReports.map((r) => ({
      id: r.id,
      targetType: r.targetType,
      reason: r.reason,
      status: r.status,
      reporterName: r.reporter.name,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
