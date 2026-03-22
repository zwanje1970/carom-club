/**
 * 게시판 목록 클라이언트 성능 로그 (브라우저).
 * `.env.local` 에 `NEXT_PUBLIC_COMMUNITY_BOARD_PERF=1` 설정 시 콘솔 출력.
 */
const ENABLED = process.env.NEXT_PUBLIC_COMMUNITY_BOARD_PERF === "1";

export function communityBoardClientPerf(
  label: string,
  extra?: Record<string, string | number | boolean | null | undefined>
): void {
  if (!ENABLED || typeof console === "undefined") return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[community-board-client] ${label}`, extra);
  } else {
    console.log(`[community-board-client] ${label}`);
  }
}
