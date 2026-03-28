/**
 * 게시판 목록 커서 페이지네이션 (v1)
 * - 필터 키 `fk`가 현재 요청과 일치할 때만 적용 (오래된 커서 무시)
 * - 정렬 종류별로 (메트릭, createdAt, id) 사전순 이전 구간만 조회
 */
import type { Prisma } from "@/generated/prisma";

export type BoardListCursorSortKind = "createdAt" | "viewCount" | "likeCount" | "commentCount";

/** `community-board-list-query`와 동일 필드 — 순환 import 방지 */
export type BoardListFiltersKeyInput = {
  boardId: string;
  slug: string;
  showHidden: boolean;
  qTitle?: string;
  statusFilter: "all" | "open" | "solved";
  popular: "today" | "weekly" | "liked" | "comments" | null;
  sort: "likes" | "comments" | "latest";
};

export type BoardListCursorPayloadV1 = {
  v: 1;
  fk: string;
  sort: BoardListCursorSortKind;
  createdAt: string;
  id: string;
  vc?: number;
  lc?: number;
  cc?: number;
};

export function buildBoardListFiltersKey(params: BoardListFiltersKeyInput): string {
  return JSON.stringify({
    bi: params.boardId,
    sl: params.slug,
    sh: params.showHidden,
    q: params.qTitle ?? "",
    st: params.statusFilter,
    po: params.popular,
    so: params.sort,
  });
}

export function sortKindFromListParams(params: BoardListFiltersKeyInput): BoardListCursorSortKind {
  const { popular, sort } = params;
  if (popular === "liked" || sort === "likes") return "likeCount";
  if (popular === "comments") return "commentCount";
  if (popular === "today" || popular === "weekly") return "viewCount";
  if (sort === "comments") return "commentCount";
  return "createdAt";
}

export function rowToCursorPayload(
  row: {
    id: string;
    createdAt: Date;
    viewCount: number;
    likeCount: number;
    commentCount: number;
  },
  fk: string,
  sort: BoardListCursorSortKind
): BoardListCursorPayloadV1 {
  const base: BoardListCursorPayloadV1 = {
    v: 1,
    fk,
    sort,
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  };
  if (sort === "viewCount") base.vc = row.viewCount;
  if (sort === "likeCount") base.lc = row.likeCount;
  if (sort === "commentCount") base.cc = row.commentCount;
  return base;
}

export function buildCursorWhere(
  sort: BoardListCursorSortKind,
  p: BoardListCursorPayloadV1
): Prisma.CommunityPostWhereInput {
  const lastId = p.id;
  const lastCa = new Date(p.createdAt);

  if (sort === "createdAt") {
    return {
      OR: [
        { createdAt: { lt: lastCa } },
        { AND: [{ createdAt: { equals: lastCa } }, { id: { lt: lastId } }] },
      ],
    };
  }

  if (sort === "viewCount") {
    const vc = p.vc ?? 0;
    return {
      OR: [
        { viewCount: { lt: vc } },
        { AND: [{ viewCount: vc }, { createdAt: { lt: lastCa } }] },
        {
          AND: [{ viewCount: vc }, { createdAt: { equals: lastCa } }, { id: { lt: lastId } }],
        },
      ],
    };
  }

  if (sort === "likeCount") {
    const lc = p.lc ?? 0;
    return {
      OR: [
        { likeCount: { lt: lc } },
        { AND: [{ likeCount: lc }, { createdAt: { lt: lastCa } }] },
        {
          AND: [{ likeCount: lc }, { createdAt: { equals: lastCa } }, { id: { lt: lastId } }],
        },
      ],
    };
  }

  const cc = p.cc ?? 0;
  return {
    OR: [
      { commentCount: { lt: cc } },
      { AND: [{ commentCount: cc }, { createdAt: { lt: lastCa } }] },
      {
        AND: [{ commentCount: cc }, { createdAt: { equals: lastCa } }, { id: { lt: lastId } }],
      },
    ],
  };
}

export function encodeBoardListCursor(p: BoardListCursorPayloadV1): string {
  return Buffer.from(JSON.stringify(p), "utf8").toString("base64url");
}

export function decodeBoardListCursor(raw: string): BoardListCursorPayloadV1 | null {
  try {
    const s = Buffer.from(raw, "base64url").toString("utf8");
    const o = JSON.parse(s) as unknown;
    if (!o || typeof o !== "object") return null;
    const v = (o as { v?: unknown }).v;
    if (v !== 1) return null;
    const fk = (o as { fk?: unknown }).fk;
    const sort = (o as { sort?: unknown }).sort;
    const createdAt = (o as { createdAt?: unknown }).createdAt;
    const id = (o as { id?: unknown }).id;
    if (typeof fk !== "string" || typeof sort !== "string") return null;
    if (typeof createdAt !== "string" || typeof id !== "string") return null;
    const allowed: BoardListCursorSortKind[] = ["createdAt", "viewCount", "likeCount", "commentCount"];
    if (!allowed.includes(sort as BoardListCursorSortKind)) return null;
    const payload: BoardListCursorPayloadV1 = {
      v: 1,
      fk,
      sort: sort as BoardListCursorSortKind,
      createdAt,
      id,
    };
    const vc = (o as { vc?: unknown }).vc;
    const lc = (o as { lc?: unknown }).lc;
    const cc = (o as { cc?: unknown }).cc;
    if (typeof vc === "number") payload.vc = vc;
    if (typeof lc === "number") payload.lc = lc;
    if (typeof cc === "number") payload.cc = cc;
    return payload;
  } catch {
    return null;
  }
}

export function validateCursorForParams(
  decoded: BoardListCursorPayloadV1 | null,
  fk: string,
  sort: BoardListCursorSortKind
): decoded is BoardListCursorPayloadV1 {
  if (!decoded) return false;
  if (decoded.fk !== fk || decoded.sort !== sort) return false;
  if (sort === "viewCount" && decoded.vc === undefined) return false;
  if (sort === "likeCount" && decoded.lc === undefined) return false;
  if (sort === "commentCount" && decoded.cc === undefined) return false;
  return true;
}
