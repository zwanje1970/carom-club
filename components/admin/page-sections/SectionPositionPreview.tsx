"use client";

import type { PageSection } from "@/types/page-section";
import type { PlacementSlug } from "@/types/page-section";
import type { PageSlug } from "@/types/page-section";
import {
  PLACEMENT_LABELS,
  PLACEMENT_TOOLTIPS,
  PLACEMENT_HINTS,
  PLACEMENT_MINIMAP_LABELS,
  SECTION_TYPE_LABELS,
} from "@/lib/content/constants";

const PLACEMENT_ORDER: PlacementSlug[] = [
  "main_visual_bg",
  "below_header",
  "below_main_copy",
  "above_content",
  "content_middle",
  "content_bottom",
];

type Props = {
  placement: PlacementSlug;
  page: PageSlug;
  sortOrder: number;
  currentSectionId: string;
  sections: PageSection[];
  onPlacementChange?: (placement: PlacementSlug) => void;
  /** wrapper className (미리보기 콘텐츠만 렌더, 레이아웃은 부모에서 제어) */
  className?: string;
};

export function SectionPositionPreview({
  placement,
  page,
  sortOrder,
  currentSectionId,
  sections,
  onPlacementChange,
  className = "w-full min-w-0",
}: Props) {
  const sectionsInSamePosition = sections.filter(
    (s) =>
      s.placement === placement &&
      s.page === page &&
      s.id !== currentSectionId
  );
  const hasCollision = sectionsInSamePosition.some((s) => s.sortOrder === sortOrder);
  const currentLabel = PLACEMENT_LABELS[placement];
  const hint = PLACEMENT_HINTS[placement];

  return (
    <div className={className}>
      <div className="rounded-xl border border-site-border bg-gray-50 p-2 dark:bg-slate-800/50">
        <div className="flex flex-col gap-0.5">
          {PLACEMENT_ORDER.map((slug) => {
            const isSelected = slug === placement;
            const label = PLACEMENT_MINIMAP_LABELS[slug];
            const tooltip = PLACEMENT_TOOLTIPS[slug];
            return (
              <div
                key={slug}
                role={onPlacementChange ? "button" : undefined}
                tabIndex={onPlacementChange ? 0 : undefined}
                onClick={() => onPlacementChange?.(slug)}
                onKeyDown={(e) => {
                  if (onPlacementChange && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onPlacementChange(slug);
                  }
                }}
                title={tooltip}
                className={`
                  rounded-lg border-2 px-3 py-2.5 text-center text-xs font-medium
                  transition-colors cursor-pointer
                  hover:border-site-primary/50 hover:bg-site-primary/5
                  ${isSelected ? "border-site-primary bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500" : "border-gray-200 bg-white dark:border-slate-600 dark:bg-slate-700/50"}
                `}
              >
                {label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-site-border bg-white p-3 dark:bg-slate-800">
        <p className="text-xs font-medium text-site-text dark:text-slate-200">
          현재 선택 위치: {currentLabel}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-slate-400">
          {hint}
        </p>
      </div>

      {sectionsInSamePosition.length > 0 && (
        <div className="mt-3 rounded-lg border border-site-border bg-white p-3 dark:bg-slate-800">
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400">
            현재 배치된 섹션
          </p>
          <ul className="mt-2 space-y-1.5">
            {sectionsInSamePosition
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-700/50"
                >
                  <span className="font-medium text-site-text dark:text-slate-200 truncate">
                    {s.title || "(제목 없음)"}
                  </span>
                  <span className="shrink-0 text-gray-500 dark:text-slate-400">
                    {SECTION_TYPE_LABELS[s.type]} · sortOrder {s.sortOrder}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      )}

      {hasCollision && (
        <div
          className="mt-3 rounded-lg border-2 border-amber-500 bg-amber-50 p-3 dark:border-amber-600 dark:bg-amber-900/20"
          role="alert"
        >
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            ⚠ 섹션 충돌 경고
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            이 위치에 동일한 정렬 순서({sortOrder})의 섹션이 이미 존재합니다. 정렬 순서를 변경해 주세요.
          </p>
        </div>
      )}
    </div>
  );
}
