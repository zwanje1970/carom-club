/**
 * 게시판 페이지 SSR 구간 로그. `COMMUNITY_LIST_PERF_LOG=1` 일 때만 (community-list-perf 와 동일 스위치).
 */
import { communityListPerfStart } from "@/lib/community-list-perf";

export function communityBoardSsrPerf(boardSlug: string): () => void {
  return communityListPerfStart(`SSR community/[boardSlug] ${boardSlug}`);
}
