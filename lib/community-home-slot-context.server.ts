import "server-only";

import { getCachedCommunityLatest } from "@/lib/community-home-data";
import type { CommunityHubPostItem } from "@/types/page-slot-render-context";

/** 커뮤니티 허브 `PageRenderer`용 slotContext.community — 공개·미리보기 동일 로직 */
export async function buildCommunityHomeSlotCommunityPayload(
  category: "all" | "free" | "qna" | "notice"
): Promise<{
  latest: CommunityHubPostItem[];
  initialCategory: typeof category;
  canManageReports: boolean;
  showSolverEntry: boolean;
}> {
  const latest = await getCachedCommunityLatest(true);
  return {
    latest,
    initialCategory: category,
    canManageReports: false,
    showSolverEntry: false,
  };
}
