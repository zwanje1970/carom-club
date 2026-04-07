/**
 * 게시판 글 목록 조회 — 목록용 필드만 (본문·imageUrls 제외), 캐시된 likeCount/commentCount 사용
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma";
import { boardListOffset } from "@/lib/community-board-list-pagination";
import { communityListPerfMeasure } from "@/lib/community-list-perf";
import { communityNoticePinnedTag } from "@/lib/community-notice-pinned-revalidate";
import {
  buildBoardListFiltersKey,
  buildCursorWhere,
  decodeBoardListCursor,
  encodeBoardListCursor,
  rowToCursorPayload,
  sortKindFromListParams,
  validateCursorForParams,
} from "@/lib/community-board-cursor";
export const BOARD_LIST_TAKE_DEFAULT = 15;
export const BOARD_LIST_TAKE_MAX = 40;

export type BoardListQueryParams = {
  boardId: string;
  slug: string;
  showHidden: boolean;
  qTitle?: string;
  statusFilter: "all" | "open" | "solved";
  popular: "today" | "weekly" | "liked" | "comments" | null;
  sort: "likes" | "comments" | "latest";
  page: number;
  take: number;
};

function buildListSelect(
  params: BoardListQueryParams
): Prisma.CommunityPostSelect {
  const sortKind = sortKindFromListParams(params);
  return {
    id: true,
    title: true,
    createdAt: true,
    ...(sortKind === "viewCount" ? { viewCount: true } : {}),
    ...(sortKind === "likeCount" ? { likeCount: true } : {}),
    ...(sortKind === "commentCount" ? { commentCount: true } : {}),
  } satisfies Prisma.CommunityPostSelect;
}

export function buildBoardListWhere(params: BoardListQueryParams): Prisma.CommunityPostWhereInput {
  const { boardId, showHidden, qTitle, statusFilter, popular, slug } = params;
  const qTrim = qTitle?.trim() ?? "";
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const popularDateWhere =
    popular === "today"
      ? { createdAt: { gte: todayStart } }
      : popular === "weekly"
        ? { createdAt: { gte: weekStart } }
        : {};

  return {
    boardId,
    ...(showHidden ? {} : { isHidden: false }),
    ...(qTrim
      ? { title: { contains: qTrim, mode: "insensitive" as const } }
      : {}),
    ...(slug === "trouble" && statusFilter === "open" ? { isSolved: false } : {}),
    ...(slug === "trouble" && statusFilter === "solved" ? { isSolved: true } : {}),
    ...popularDateWhere,
  };
}

export function buildBoardListOrderBy(params: BoardListQueryParams): Prisma.CommunityPostOrderByWithRelationInput | Prisma.CommunityPostOrderByWithRelationInput[] {
  const { popular, sort } = params;
  if (popular === "liked") {
    return [{ likeCount: "desc" }, { createdAt: "desc" }];
  }
  if (popular === "comments") {
    return [{ commentCount: "desc" }, { createdAt: "desc" }];
  }
  if (popular === "today" || popular === "weekly") {
    return [{ viewCount: "desc" }, { createdAt: "desc" }];
  }
  if (sort === "likes") {
    return [{ likeCount: "desc" }, { createdAt: "desc" }];
  }
  if (sort === "comments") {
    return [{ commentCount: "desc" }, { createdAt: "desc" }];
  }
  return { createdAt: "desc" };
}

export type BoardListRow = {
  id: string;
  title: string;
  createdAt: Date;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
};

/** 공지 고정글 캐시 키 — 필터·로컬 달력(오늘/주간)·검색어 반영 */
function noticePinnedCacheKeyParts(params: BoardListQueryParams): string[] {
  const q = params.qTitle?.trim() ?? "";
  const d = new Date();
  const localDay = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  return [
    "np1",
    params.boardId,
    String(params.showHidden),
    q,
    String(params.popular ?? ""),
    params.statusFilter,
    params.slug,
    localDay,
  ];
}

async function fetchNoticePinnedUncached(params: BoardListQueryParams): Promise<BoardListRow[]> {
  const where: Prisma.CommunityPostWhereInput = { ...buildBoardListWhere(params), isPinned: true };
  const select = buildListSelect(params);
  const rows = await prisma.communityPost.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select,
  });
  return rows as BoardListRow[];
}

/**
 * 공지(notice) 고정글만 짧게 캐시(revalidate 45s + 태그 무효화).
 * 일반 목록과 분리된 별도 쿼리.
 */
export function getNoticePinnedCached(params: BoardListQueryParams): Promise<BoardListRow[]> {
  if (params.slug !== "notice") return Promise.resolve([]);
  const key = noticePinnedCacheKeyParts(params);
  const tag = communityNoticePinnedTag(params.boardId);
  return unstable_cache(
    async () => fetchNoticePinnedUncached(params),
    key,
    { revalidate: 45, tags: [tag] }
  )();
}

export function formatBoardListRow(p: BoardListRow) {
  return {
    id: p.id,
    title: p.title,
    createdAt: p.createdAt.toISOString(),
  };
}

export async function queryBoardPostLists(
  params: BoardListQueryParams,
  options?: { tx?: Prisma.TransactionClient; cursor?: string | null }
): Promise<{ pinned: BoardListRow[]; list: BoardListRow[]; nextCursor: string | null }> {
  const db = options?.tx ?? prisma;
  const where = buildBoardListWhere(params);
  const orderBy = buildBoardListOrderBy(params);
  const { slug, page, take } = params;
  const limit = take;

  const fk = buildBoardListFiltersKey(params);
  const sortKind = sortKindFromListParams(params);
  const decoded = options?.cursor ? decodeBoardListCursor(options.cursor.trim()) : null;
  const useCursor = Boolean(options?.cursor?.trim()) && validateCursorForParams(decoded, fk, sortKind);

  const listBaseWhere: Prisma.CommunityPostWhereInput =
    slug === "notice" ? { ...where, isPinned: false } : where;

  const listWhere: Prisma.CommunityPostWhereInput = useCursor
    ? { AND: [listBaseWhere, buildCursorWhere(sortKind, decoded)] }
    : listBaseWhere;

  const { skip } = useCursor ? { skip: 0 } : boardListOffset(page, take);

  const qLog = params.qTitle?.trim() ? "search" : "nosearch";
  const select = buildListSelect(params);

  const [pinned, list] = await Promise.all([
    slug === "notice"
      ? communityListPerfMeasure(`notice_pinned_${qLog}`, () => getNoticePinnedCached(params))
      : Promise.resolve([] as BoardListRow[]),
    communityListPerfMeasure(`list_main_${qLog}`, () =>
      db.communityPost.findMany({
        where: listWhere,
        orderBy,
        skip,
        take: limit,
        select,
      })
    ),
  ]);

  const rows = list as BoardListRow[];
  let nextCursor: string | null = null;
  if (rows.length === limit && rows.length > 0) {
    const last = rows[rows.length - 1]!;
    nextCursor = encodeBoardListCursor(
      rowToCursorPayload(
        {
          id: last.id,
          createdAt: last.createdAt,
          viewCount: last.viewCount ?? 0,
          likeCount: last.likeCount ?? 0,
          commentCount: last.commentCount ?? 0,
        },
        fk,
        sortKind
      )
    );
  }

  return {
    pinned: pinned as BoardListRow[],
    list: rows,
    nextCursor,
  };
}
