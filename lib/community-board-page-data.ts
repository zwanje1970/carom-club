import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { ensureDefaultCommunityBoards } from "@/lib/community-ensure-boards";
import { isCommunityModerator } from "@/lib/community-roles";
import type { SessionUser } from "@/types/auth";
import { COMMUNITY_HUB_SLUGS, orderedHubBoards } from "@/components/community/communityBoardConstants";
import {
  BOARD_LIST_TAKE_DEFAULT,
  formatBoardListRow,
  queryBoardPostLists,
  type BoardListQueryParams,
} from "@/lib/community-board-list-query";
import {
  buildCommunityBoardQueryKey,
  type CommunityBoardPopularMode,
} from "@/lib/community-board-query-key";

export type BoardListPostDto = ReturnType<typeof formatBoardListRow>;

export type CommunityBoardPagePayload = {
  hubBoards: { id: string; slug: string; name: string }[];
  board: { id: string; slug: string; name: string };
  pinned: BoardListPostDto[];
  posts: BoardListPostDto[];
  hasMore: boolean;
  /** 다음 페이지(더보기)용 커서 — 없으면 끝 */
  nextCursor: string | null;
  take: number;
  popular: CommunityBoardPopularMode;
  page: number;
  q: string;
  statusFilter: "all" | "open" | "solved";
  initialQueryKey: string;
};

function parsePopular(raw: string | undefined): CommunityBoardPopularMode {
  if (raw === "weekly" || raw === "liked" || raw === "comments" || raw === "today") return raw;
  return "today";
}

function parseStatus(
  slug: string,
  raw: string | undefined
): "all" | "open" | "solved" {
  if (slug !== "trouble") return "all";
  if (raw === "open" || raw === "solved") return raw;
  return "all";
}

/**
 * 게시판 목록 첫 화면용 서버 데이터 (API와 동일 규칙).
 */
export async function loadCommunityBoardPageData(
  boardSlug: string,
  searchParams: Record<string, string | string[] | undefined>,
  session: SessionUser | null
): Promise<
  | { ok: true; data: CommunityBoardPagePayload }
  | { ok: false; reason: "no_db" | "not_found" }
> {
  if (!isDatabaseConfigured()) {
    return { ok: false, reason: "no_db" };
  }

  const popularRaw = typeof searchParams.popular === "string" ? searchParams.popular : undefined;
  const popular = parsePopular(popularRaw);
  const qRaw = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const pageRaw = typeof searchParams.page === "string" ? Number(searchParams.page) : 0;
  const page = Math.max(0, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 0);
  const take = BOARD_LIST_TAKE_DEFAULT;
  const statusFilter = parseStatus(boardSlug, typeof searchParams.status === "string" ? searchParams.status : undefined);
  const cursorRaw =
    typeof searchParams.cursor === "string" && searchParams.cursor.trim()
      ? searchParams.cursor.trim()
      : undefined;

  const showHidden = isCommunityModerator(session);

  const [hubRows, board] = await Promise.all([
    prisma.communityBoard.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, slug: true, name: true },
    }),
    prisma.communityBoard.findUnique({
      where: { slug: boardSlug },
      select: { id: true, slug: true, name: true },
    }),
  ]);

  let resolvedBoard = board;
  if (!resolvedBoard) {
    await ensureDefaultCommunityBoards();
    resolvedBoard = await prisma.communityBoard.findUnique({
      where: { slug: boardSlug },
      select: { id: true, slug: true, name: true },
    });
  }
  if (!resolvedBoard) {
    return { ok: false, reason: "not_found" };
  }

  const hubBoards = orderedHubBoards(
    hubRows.filter((b) => COMMUNITY_HUB_SLUGS.includes(b.slug as (typeof COMMUNITY_HUB_SLUGS)[number]))
  );

  const popularParam: BoardListQueryParams["popular"] = popular;
  const listParams: BoardListQueryParams = {
    boardId: resolvedBoard.id,
    slug: boardSlug,
    showHidden,
    qTitle: qRaw || undefined,
    statusFilter,
    popular: popularParam,
    sort: "latest",
    page,
    take,
  };

  const { pinned, list, nextCursor } = await queryBoardPostLists(listParams, {
    cursor: cursorRaw ?? null,
  });

  const initialQueryKey =
    buildCommunityBoardQueryKey({
      boardSlug,
      popular,
      page,
      q: qRaw,
      statusFilter,
    }) + (cursorRaw ? `|cursor:${cursorRaw.slice(0, 64)}` : "");

  return {
    ok: true,
    data: {
      hubBoards,
      board: resolvedBoard,
      pinned: pinned.map(formatBoardListRow),
      posts: list.map(formatBoardListRow),
      hasMore: list.length === take,
      nextCursor,
      take,
      popular,
      page,
      q: qRaw,
      statusFilter,
      initialQueryKey,
    },
  };
}
