/**
 * 커뮤니티 홈 인기글·게시판 목록 — unstable_cache로 요청 간 재사용.
 * 태그 `community-home` — 글 작성/삭제 등에서 revalidateTag로 무효화.
 */

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TAKE = 10;
const LATEST_TAKE = 25;
const REVALIDATE_SECONDS = 45;

export const COMMUNITY_HOME_CACHE_TAG = "community-home";

const listSelect = {
  id: true,
  title: true,
  createdAt: true,
  board: { select: { slug: true } },
} as const;

export type CommunityHomePostItem = {
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

export type CommunityHomePopular = {
  today: CommunityHomePostItem[];
  weekly: CommunityHomePostItem[];
  mostLiked: CommunityHomePostItem[];
  mostComments: CommunityHomePostItem[];
};

export type CommunityHomeLatest = CommunityHomePostItem[];

function format(p: {
  id: string;
  title: string;
  createdAt: Date;
  board: { slug: string };
}): CommunityHomePostItem {
  return {
    id: p.id,
    title: p.title,
    authorName: "",
    likeCount: 0,
    commentCount: 0,
    viewCount: 0,
    createdAt: p.createdAt.toISOString(),
    boardSlug: p.board.slug,
    boardName: "",
  };
}

export async function getCachedCommunityBoards(): Promise<
  { id: string; slug: string; name: string; type: string }[]
> {
  if (!isDatabaseConfigured()) return [];
  try {
    return await unstable_cache(
      async () =>
        prisma.communityBoard.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
          select: { id: true, slug: true, name: true, type: true },
        }),
      ["community-home-boards"],
      { revalidate: REVALIDATE_SECONDS, tags: [COMMUNITY_HOME_CACHE_TAG] }
    )();
  } catch {
    return [];
  }
}

/**
 * @param excludeTroubleBoard 비로그인 시 true — 인기글에서 난구해결(trouble) 제외
 */
export async function getCachedCommunityPopular(
  excludeTroubleBoard: boolean
): Promise<CommunityHomePopular> {
  const empty: CommunityHomePopular = {
    today: [],
    weekly: [],
    mostLiked: [],
    mostComments: [],
  };
  if (!isDatabaseConfigured()) return empty;

  const variant = excludeTroubleBoard ? "anon" : "auth";

  try {
    return await unstable_cache(
      async () => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);

        const hiddenFilter = {
          isHidden: false,
          ...(excludeTroubleBoard ? { board: { slug: { not: "trouble" as const } } } : {}),
        };

        const [todayPosts, weekPosts, mostLikedPosts, mostCommentPosts] = await Promise.all([
          prisma.communityPost.findMany({
            where: { ...hiddenFilter, createdAt: { gte: todayStart } },
            orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
            take: TAKE,
            select: listSelect,
          }),
          prisma.communityPost.findMany({
            where: { ...hiddenFilter, createdAt: { gte: weekStart } },
            orderBy: [{ viewCount: "desc" }, { createdAt: "desc" }],
            take: TAKE,
            select: listSelect,
          }),
          prisma.communityPost.findMany({
            where: hiddenFilter,
            orderBy: [{ likeCount: "desc" }, { createdAt: "desc" }],
            take: TAKE,
            select: listSelect,
          }),
          prisma.communityPost.findMany({
            where: hiddenFilter,
            orderBy: [{ commentCount: "desc" }, { createdAt: "desc" }],
            take: TAKE,
            select: listSelect,
          }),
        ]);

        return {
          today: todayPosts.map(format),
          weekly: weekPosts.map(format),
          mostLiked: mostLikedPosts.map(format),
          mostComments: mostCommentPosts.map(format),
        };
      },
      ["community-home-popular", variant],
      { revalidate: REVALIDATE_SECONDS, tags: [COMMUNITY_HOME_CACHE_TAG] }
    )();
  } catch {
    return empty;
  }
}

/**
 * 커뮤니티 홈 통합 뷰: 전체 게시글 최신순.
 * @param excludeTroubleBoard 비로그인 시 true — trouble 제외
 */
export async function getCachedCommunityLatest(
  excludeTroubleBoard: boolean
): Promise<CommunityHomeLatest> {
  if (!isDatabaseConfigured()) return [];
  const variant = excludeTroubleBoard ? "anon" : "auth";
  try {
    return await unstable_cache(
      async () => {
        const where = {
          isHidden: false,
          ...(excludeTroubleBoard ? { board: { slug: { not: "trouble" as const } } } : {}),
        };
        const rows = await prisma.communityPost.findMany({
          where,
          orderBy: [{ createdAt: "desc" }],
          take: LATEST_TAKE,
          select: listSelect,
        });
        return rows.map(format);
      },
      ["community-home-latest", variant],
      { revalidate: REVALIDATE_SECONDS, tags: [COMMUNITY_HOME_CACHE_TAG] }
    )();
  } catch {
    return [];
  }
}
