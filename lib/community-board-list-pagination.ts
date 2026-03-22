/**
 * 오프셋 페이지네이션 (page>0·커서 없을 때, 북마크 호환).
 * 커서: `lib/community-board-cursor.ts` (`encodeBoardListCursor` 등).
 */

export function boardListOffset(page: number, take: number): { skip: number; take: number } {
  const p = Math.max(0, Math.floor(page));
  return { skip: p * take, take };
}
