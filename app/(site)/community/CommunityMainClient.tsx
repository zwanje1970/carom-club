"use client";

import { CommunityPostListSection } from "@/components/community/CommunityPostListSection";
import type { CommunityHubPostItem } from "@/types/page-slot-render-context";

export function CommunityMainClient({
  copy,
  latest,
  initialCategory,
  showSolverEntry,
}: {
  copy: Record<string, string>;
  latest: CommunityHubPostItem[];
  initialCategory: "all" | "free" | "qna" | "notice";
  showSolverEntry: boolean;
}) {
  return (
    <div className="pb-20">
      <CommunityPostListSection
        latest={latest}
        initialCategory={initialCategory}
        showSolverEntry={showSolverEntry}
      />
    </div>
  );
}
