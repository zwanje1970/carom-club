/**
 * 난구노트 "새 작성" 페이지와 목록 간 이동 시 sessionStorage 초기화용.
 * React Strict Mode 재마운트에서는 가드로 이중 삭제를 막는다.
 */
export const BILLIARD_NOTE_NEW_PAGE_GUARD = "billiardNoteNewPageGuard";

export const BALL_LAYOUT_IMAGE_KEY = "ballLayoutImage";
export const BALL_LAYOUT_PLACEMENT_KEY = "billiardNotePlacement";
export const BILLIARD_NOTE_DRAFT_KEY = "billiardNoteDraft";

export function clearBilliardNoteNewPageGuardOnly(): void {
  try {
    sessionStorage.removeItem(BILLIARD_NOTE_NEW_PAGE_GUARD);
  } catch {
    /* ignore */
  }
}
