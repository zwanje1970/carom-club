/** CommunityPopularPills 값과 동일 (lib ↔ client 경계 분리) */
export type CommunityBoardPopularMode = "today" | "weekly" | "liked" | "comments";

/** 서버·클라이언트 동일 규칙으로 직렬화 — 초기 데이터와 일치 시 클라이언트 첫 fetch 생략 */
export function buildCommunityBoardQueryKey(input: {
  boardSlug: string;
  popular: CommunityBoardPopularMode;
  page: number;
  q: string;
  statusFilter: "all" | "open" | "solved";
}): string {
  return JSON.stringify({
    boardSlug: input.boardSlug,
    popular: input.popular,
    page: input.page,
    q: input.q.trim(),
    status: input.statusFilter,
  });
}
