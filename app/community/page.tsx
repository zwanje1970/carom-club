import { getCommonPageData } from "@/lib/common-page-data";
import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
import { CommunityMainClient } from "./CommunityMainClient";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TAKE = 10;
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
  const [, session] = await Promise.all([getCommonPageData("community"), getSession()]);
  const canManageReports_ = canManageReports(session);

  let boards: { id: string; slug: string; name: string; type: string }[] = [];
  let popular: Popular = {
    today: [],
    weekly: [],
    mostLiked: [],
    mostComments: [],
  };
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

      /** 비로그인 시 커뮤니티 홈 인기글에서 난구해결(trouble) 노출 제외 */
      const hiddenFilter = {
        isHidden: false,
        ...(session ? {} : { board: { slug: { not: "trouble" as const } } }),
      };

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

      const [todayPosts, weekPosts, mostLikedPosts, mostCommentPosts] = await Promise.all([
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
      ]);

      popular = {
        today: todayPosts.map(format),
        weekly: weekPosts.map(format),
        mostLiked: mostLikedPosts.map(format),
        mostComments: mostCommentPosts.map(format),
      };
    } catch {
      // Prisma client 미재생성(communityBoard 없음) 또는 DB 오류 시 빈 목록 유지
    }
  }

  return (
    <main className="min-h-screen bg-site-bg text-site-text">
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <CommunityMainClient boards={boards} popular={popular} canManageReports={canManageReports_} />
      </div>
    </main>
  );
}
