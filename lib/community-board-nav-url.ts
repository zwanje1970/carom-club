import type { CommunityBoardPopularMode } from "@/lib/community-board-query-key";

/** 게시판 목록 쿼리만 (경로 제외). `popular=today` 는 생략 */
export function buildCommunityBoardListQueryString(input: {
  boardSlug: string;
  popular: CommunityBoardPopularMode;
  q: string;
  statusFilter: "all" | "open" | "solved";
}): string {
  const p = new URLSearchParams();
  if (input.popular !== "today") p.set("popular", input.popular);
  const qv = input.q.trim();
  if (qv) p.set("q", qv);
  if (input.boardSlug === "trouble" && input.statusFilter !== "all") {
    p.set("status", input.statusFilter);
  }
  return p.toString();
}

export function communityBoardListHref(boardSlug: string, query: string): string {
  const base = boardSlug === "trouble" ? "/community/trouble" : `/community/${boardSlug}`;
  return query ? `${base}?${query}` : base;
}
