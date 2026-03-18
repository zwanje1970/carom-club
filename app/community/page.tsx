import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { getCommonPageData } from "@/lib/common-page-data";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
import { CommunityMainClient } from "./CommunityMainClient";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TAKE = 10;
const LATEST_TAKE = 20;

type PostItem = {
  id: string;
  title: string;
  authorName: string;
  likeCount: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  boardSlug: string;
  boardName: string;
};

type Popular = {
  today: PostItem[];
  weekly: PostItem[];
  mostLiked: PostItem[];
  mostComments: PostItem[];
};

export default async function CommunityPage() {
  const [common, session] = await Promise.all([getCommonPageData("community"), getSession()]);
  const c = common.copy as Record<AdminCopyKey, string>;
  const communityTitle = getCopyValue(c, "site.community.title");
  const canManageReports_ = canManageReports(session);

  let boards: { id: string; slug: string; name: string; type: string }[] = [];
  let popular: Popular = {
    today: [],
    weekly: [],
    mostLiked: [],
    mostComments: [],
  };
  let latest: PostItem[] = [];
  const latestByBoard: Record<string, { id: string; title: string; authorName: string; likeCount: number; commentCount: number; createdAt: string }[]> = {
    free: [],
    qna: [],
    tips: [],
    reviews: [],
  };
  let troubleStats = { open: 0, solved: 0 };

  if (isDatabaseConfigured()) {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      boards = await prisma.communityBoard.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, slug: true, name: true, type: true },
      });

      // 게시판별 최신 3개 (최소 필드만)
      const boardSlugs = ["free", "qna", "tips", "reviews"] as const;
      const hiddenFilter = { isHidden: false };
      const minimalPostSelect = {
        id: true,
        title: true,
        createdAt: true,
        likeCount: true,
        commentCount: true,
        author: { select: { name: true } },
      } as const;
      const latestFetches = boardSlugs.map((slug) =>
        prisma.communityPost.findMany({
          where: { ...hiddenFilter, board: { slug } },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: minimalPostSelect,
        })
      );
      const latestResults = await Promise.all(latestFetches);
      boardSlugs.forEach((slug, i) => {
        latestByBoard[slug] = latestResults[i].map((p) => ({
          id: p.id,
          title: p.title,
          authorName: p.author.name,
          likeCount: p.likeCount ?? 0,
          commentCount: p.commentCount ?? 0,
          createdAt: p.createdAt.toISOString(),
        }));
      });

      // 난구해결사 진행중/해결 수 (TroubleShotPost)
      try {
        const troubleBoard = await prisma.communityBoard.findFirst({ where: { slug: "trouble" }, select: { id: true } });
        if (troubleBoard) {
          const [openCount, solvedCount] = await Promise.all([
            prisma.troubleShotPost.count({ where: { post: { boardId: troubleBoard.id }, isSolved: false } }),
            prisma.troubleShotPost.count({ where: { post: { boardId: troubleBoard.id }, isSolved: true } }),
          ]);
          troubleStats = { open: openCount, solved: solvedCount };
        }
      } catch {
        troubleStats = { open: 0, solved: 0 };
      }

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

      const [todayPosts, weekPosts, mostLikedPosts, mostCommentPosts, latestPosts] = await Promise.all([
        prisma.communityPost.findMany({
          where: { ...hiddenFilter, createdAt: { gte: todayStart } },
          orderBy: { viewCount: "desc" },
          take: TAKE,
          select: { id: true, title: true, viewCount: true, createdAt: true, board: { select: { slug: true, name: true } }, author: { select: { name: true } }, _count: { select: { likes: true, comments: true } } },
        }),
        prisma.communityPost.findMany({
          where: { ...hiddenFilter, createdAt: { gte: weekStart } },
          orderBy: { viewCount: "desc" },
          take: TAKE,
          select: { id: true, title: true, viewCount: true, createdAt: true, board: { select: { slug: true, name: true } }, author: { select: { name: true } }, _count: { select: { likes: true, comments: true } } },
        }),
        prisma.communityPost.findMany({
          where: hiddenFilter,
          orderBy: { likes: { _count: "desc" } },
          take: TAKE,
          select: { id: true, title: true, viewCount: true, createdAt: true, board: { select: { slug: true, name: true } }, author: { select: { name: true } }, _count: { select: { likes: true, comments: true } } },
        }),
        prisma.communityPost.findMany({
          where: hiddenFilter,
          orderBy: { comments: { _count: "desc" } },
          take: TAKE,
          select: { id: true, title: true, viewCount: true, createdAt: true, board: { select: { slug: true, name: true } }, author: { select: { name: true } }, _count: { select: { likes: true, comments: true } } },
        }),
        prisma.communityPost.findMany({
          where: hiddenFilter,
          orderBy: { createdAt: "desc" },
          take: LATEST_TAKE,
          select: { id: true, title: true, viewCount: true, createdAt: true, board: { select: { slug: true, name: true } }, author: { select: { name: true } }, _count: { select: { likes: true, comments: true } } },
        }),
      ]);

      popular = {
        today: todayPosts.map(format),
        weekly: weekPosts.map(format),
        mostLiked: mostLikedPosts.map(format),
        mostComments: mostCommentPosts.map(format),
      };
      latest = latestPosts.map(format);
    } catch {
      // Prisma client 미재생성(communityBoard 없음) 또는 DB 오류 시 빈 목록 유지
    }
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4" aria-label="breadcrumb">
          <Link href="/community" className="hover:text-site-primary">{communityTitle}</Link>
        </nav>
        <h1 className="text-2xl font-bold text-site-text">{communityTitle}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">{getCopyValue(c, "site.community.subtitle")}</p>

        <CommunityMainClient
          boards={boards}
          popular={popular}
          latest={latest}
          latestByBoard={latestByBoard}
          troubleStats={troubleStats}
          canManageReports={canManageReports_}
        />
      </div>
    </main>
  );
}
