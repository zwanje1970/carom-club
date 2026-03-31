"use client";

import type { PageSection, PageSlug } from "@/types/page-section";

export type SectionToolMode = "structure" | "design";

type Props = {
  mode: SectionToolMode;
  section: PageSection;
  currentPage: PageSlug;
  slotSectionStyleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (json: string) => void;
  onClose: () => void;
  onStructureSaved: (updated: PageSection) => void;
  onMovedAway: () => void;
  onDuplicated: () => void;
  setBusy: (id: string | null) => void;
};

export function SectionRowTools({ mode }: Props) {
  return (
    <div className="rounded border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-600 dark:border-slate-600 dark:text-slate-300">
      블록 구조/디자인 설정은 현재 통합 편집 패널에서 관리됩니다. (모드: {mode})
    </div>
  );
}
