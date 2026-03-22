import { revalidateTag } from "next/cache";

/** `unstable_cache` 공지 고정글 태그 — 공지 작성·수정·삭제 시 무효화 */
export function communityNoticePinnedTag(boardId: string): string {
  return `community-board-notice-${boardId}`;
}

export function revalidateCommunityNoticePinned(boardId: string): void {
  try {
    revalidateTag(communityNoticePinnedTag(boardId));
  } catch {
    /* 빌드/비-Next 환경 등 */
  }
}
