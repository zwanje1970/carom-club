import "server-only";

import { getSession } from "@/lib/auth";
import { canManageReports } from "@/lib/community-roles";
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
  const [session, latest] = await Promise.all([getSession(), getCachedCommunityLatest(true)]);
  const canManageReports_ = canManageReports(session);
  return {
    latest,
    initialCategory: category,
    canManageReports: canManageReports_,
    showSolverEntry: false,
  };
}
