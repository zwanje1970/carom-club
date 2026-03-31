"use client";

import { useCallback, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { mdiDragVertical } from "@mdi/js";
import Icon from "@mdi/react";
import type { PageSection } from "@/types/page-section";

type SectionEditorProps = {
  sections: PageSection[];
  /** true면 드래그·키보드 정렬 비활성 (저장 중·로딩 등) */
  reorderDisabled?: boolean;
  rowLabel: (s: PageSection) => string;
  metaLine: (s: PageSection, index: number) => string;
  /** 드래그 종료 후 확정 순서만 반영. 실패 시 부모가 이전 목록으로 되돌림 */
  onReorderCommit: (nextSections: PageSection[]) => Promise<void>;
  renderRowActions: (s: PageSection, index: number) => ReactNode;
  /** 행 아래 확장 패널(구조 설정·이동 등) */
  renderRowBelow?: (s: PageSection, index: number) => ReactNode;
  /** 슬롯 타입·순서·상태 배지 등 */
  renderStatusBadges?: (s: PageSection, index: number) => ReactNode;
};

function SortableRow({
  section,
  index,
  reorderDisabled,
  rowLabel,
  metaLine,
  renderRowActions,
  renderRowBelow,
  renderStatusBadges,
}: {
  section: PageSection;
  index: number;
  reorderDisabled: boolean;
  rowLabel: (s: PageSection) => string;
  metaLine: (s: PageSection, index: number) => string;
  renderRowActions: (s: PageSection, index: number) => ReactNode;
  renderRowBelow?: (s: PageSection, index: number) => ReactNode;
  renderStatusBadges?: (s: PageSection, index: number) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    disabled: reorderDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : undefined,
  };

  const below = renderRowBelow?.(section, index);

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`border-b border-gray-200 py-3 last:border-b-0 dark:border-slate-700 ${
        !section.isVisible || section.deletedAt ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="touch-none rounded border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="순서 변경(드래그)"
          disabled={reorderDisabled}
          {...attributes}
          {...listeners}
        >
          <Icon path={mdiDragVertical} size={1} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-gray-900 dark:text-slate-100">{rowLabel(section)}</div>
          <div className="text-xs text-gray-500 dark:text-slate-400">{metaLine(section, index)}</div>
          {renderStatusBadges ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">{renderStatusBadges(section, index)}</div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">{renderRowActions(section, index)}</div>
      </div>
      {below ? <div className="mt-3 border-t border-dashed border-gray-200 pt-3 dark:border-slate-600">{below}</div> : null}
    </li>
  );
}

function OverlayPreview({
  section,
  index,
  rowLabel,
  metaLine,
}: {
  section: PageSection;
  index: number;
  rowLabel: (s: PageSection) => string;
  metaLine: (s: PageSection, index: number) => string;
}) {
  return (
    <div
      className={`flex max-w-2xl flex-wrap items-center gap-2 rounded border border-gray-300 bg-white py-3 pl-2 pr-3 shadow-lg dark:border-slate-600 dark:bg-slate-900 ${
        !section.isVisible || section.deletedAt ? "opacity-60" : ""
      }`}
    >
      <span className="p-1.5 text-gray-400">
        <Icon path={mdiDragVertical} size={1} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 dark:text-slate-100">{rowLabel(section)}</div>
        <div className="text-xs text-gray-500 dark:text-slate-400">{metaLine(section, index)}</div>
      </div>
    </div>
  );
}

/**
 * 페이지 빌더용 섹션 목록 — dnd-kit으로 순서만 조정.
 * 드래그 핸들에만 포인터 리스너를 두어 버튼·링크와 충돌하지 않게 함.
 */
export function SectionEditor({
  sections,
  reorderDisabled = false,
  rowLabel,
  metaLine,
  onReorderCommit,
  renderRowActions,
  renderRowBelow,
  renderStatusBadges,
}: SectionEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const itemIds = sections.map((s) => s.id);

  const onDragStart = useCallback((e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  }, []);

  const onDragEnd = useCallback(
    async (e: DragEndEvent) => {
      const { active, over } = e;
      setActiveId(null);
      if (reorderDisabled || !over) return;
      if (active.id === over.id) return;

      const oldIndex = sections.findIndex((s) => s.id === active.id);
      const newIndex = sections.findIndex((s) => s.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(sections, oldIndex, newIndex);
      await onReorderCommit(next);
    },
    [sections, reorderDisabled, onReorderCommit]
  );

  const onDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const activeSection = activeId ? sections.find((s) => s.id === activeId) : undefined;
  const activeIndex = activeSection ? sections.findIndex((s) => s.id === activeSection.id) : -1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={(e) => void onDragEnd(e)}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <ul className="list-none p-0">
          {sections.map((s, i) => (
            <SortableRow
              key={s.id}
              section={s}
              index={i}
              reorderDisabled={reorderDisabled}
              rowLabel={rowLabel}
              metaLine={metaLine}
              renderRowActions={renderRowActions}
              renderRowBelow={renderRowBelow}
              renderStatusBadges={renderStatusBadges}
            />
          ))}
        </ul>
      </SortableContext>
      <DragOverlay dropAnimation={null}>
        {activeSection && activeIndex >= 0 ? (
          <OverlayPreview
            section={activeSection}
            index={activeIndex}
            rowLabel={rowLabel}
            metaLine={metaLine}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
