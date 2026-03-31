"use client";

import { CommunityNanguPromoCard } from "@/components/community/CommunityNanguPromoCard";
import { CommunityPostListSection } from "@/components/community/CommunityPostListSection";
import type { CommunityHubPostItem } from "@/types/page-slot-render-context";

export function CommunityMainClient({
  latest,
  initialCategory,
  canManageReports = false,
  showSolverEntry,
}: {
  latest: CommunityHubPostItem[];
  initialCategory: "all" | "free" | "qna" | "notice";
  canManageReports?: boolean;
  showSolverEntry: boolean;
}) {
  return (
    <div className="pb-20">
      <CommunityNanguPromoCard />
      <CommunityPostListSection
        latest={latest}
        initialCategory={initialCategory}
        canManageReports={canManageReports}
        showSolverEntry={showSolverEntry}
      />
    </div>
  );
}
