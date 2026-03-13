"use client";

import { useState, useEffect } from "react";
import type { PageSection } from "@/types/page-section";
import { PAGE_LABELS, PLACEMENT_LABELS, SECTION_TYPE_LABELS } from "@/lib/content/constants";
import Button from "@/components/admin/_components/Button";

type Props = {
  sections: PageSection[];
  pageFilter: string;
  placementFilter: string;
  visibleFilter: string;
  onPageFilterChange: (v: string) => void;
  onPlacementFilterChange: (v: string) => void;
  onVisibleFilterChange: (v: string) => void;
  onDelete: (id: string) => void;
  /** 드래그 정렬 후 목록 다시 불러오기 (refetch) */
  onReorderRefetch?: () => void;
};

export function PageSectionList({
  sections,
  pageFilter,
  placementFilter,
  visibleFilter,
  onPageFilterChange,
  onPlacementFilterChange,
  onVisibleFilterChange,
  onDelete,
  onReorderRefetch,
}: Props) {
  const filtered = sections.filter((s) => {
    if (pageFilter && s.page !== pageFilter) return false;
    if (placementFilter && s.placement !== placementFilter) return false;
    if (visibleFilter === "visible" && !s.isVisible) return false;
    if (visibleFilter === "hidden" && s.isVisible) return false;
    return true;
  });

  const canReorder = !!pageFilter && !!placementFilter;
  const [orderIds, setOrderIds] = useState<string[]>(() => filtered.map((s) => s.id));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [reorderSaving, setReorderSaving] = useState(false);

  useEffect(() => {
    setOrderIds(filtered.map((s) => s.id));
  }, [pageFilter, placementFilter, visibleFilter, sections]);

  const displayList: PageSection[] = orderIds
    .map((id) => filtered.find((s) => s.id === id))
    .filter((s): s is PageSection => !!s);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDraggingId(null);
    const sourceId = e.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) return;
    const idx = orderIds.indexOf(sourceId);
    const targetIdx = orderIds.indexOf(targetId);
    if (idx === -1 || targetIdx === -1) return;
    const next = [...orderIds];
    next.splice(idx, 1);
    next.splice(targetIdx, 0, sourceId);
    setOrderIds(next);
    setReorderSaving(true);
    fetch("/api/admin/content/page-sections/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: pageFilter,
        placement: placementFilter,
        sectionIds: next,
      }),
    })
      .then((res) => (res.ok ? onReorderRefetch?.() : undefined))
      .finally(() => setReorderSaving(false));
  };

  const handleDragEnd = () => setDraggingId(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-center">
        <select
          value={pageFilter}
          onChange={(e) => onPageFilterChange(e.target.value)}
          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
        >
          <option value="">전체 페이지</option>
          {(Object.entries(PAGE_LABELS) as [keyof typeof PAGE_LABELS, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={placementFilter}
          onChange={(e) => onPlacementFilterChange(e.target.value)}
          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
        >
          <option value="">전체 위치</option>
          {(Object.entries(PLACEMENT_LABELS) as [keyof typeof PLACEMENT_LABELS, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={visibleFilter}
          onChange={(e) => onVisibleFilterChange(e.target.value)}
          className="rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
        >
          <option value="">전체</option>
          <option value="visible">표시</option>
          <option value="hidden">숨김</option>
        </select>
        {canReorder && (
          <span className="text-xs text-gray-500">
            같은 페이지·위치 내에서 ≡ 드래그로 정렬 가능
            {reorderSaving && " (저장 중…)"}
          </span>
        )}
      </div>
      <div className="overflow-x-auto rounded-lg border border-site-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-site-border bg-gray-50 dark:bg-slate-800">
            <tr>
              {canReorder && <th className="w-10 p-3 font-medium" aria-label="드래그" />}
              <th className="p-3 font-medium">썸네일</th>
              <th className="p-3 font-medium">섹션 제목</th>
              <th className="p-3 font-medium">섹션 유형</th>
              <th className="p-3 font-medium">노출 페이지</th>
              <th className="p-3 font-medium">노출 위치</th>
              <th className="p-3 font-medium">정렬 순서</th>
              <th className="p-3 font-medium">노출 상태</th>
              <th className="p-3 font-medium">링크</th>
              <th className="p-3 font-medium">동작</th>
            </tr>
          </thead>
          <tbody>
            {displayList.length === 0 ? (
              <tr>
                <td colSpan={canReorder ? 10 : 9} className="p-6 text-center text-gray-500">
                  조건에 맞는 섹션이 없습니다.
                </td>
              </tr>
            ) : (
              displayList.map((s) => (
                <tr
                  key={s.id}
                  draggable={canReorder}
                  onDragStart={(e) => handleDragStart(e, s.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, s.id)}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-site-border hover:bg-gray-50 dark:hover:bg-slate-800/50 ${
                    draggingId === s.id ? "opacity-50" : ""
                  }`}
                >
                  {canReorder && (
                    <td className="p-3 cursor-grab active:cursor-grabbing" title="드래그하여 순서 변경">
                      <span className="text-gray-400 select-none" aria-hidden>≡</span>
                    </td>
                  )}
                  <td className="p-3">
                    {s.imageUrl ? (
                      <div className="h-12 w-20 overflow-hidden rounded bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.imageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3 font-medium">{s.title || "—"}</td>
                  <td className="p-3">{SECTION_TYPE_LABELS[s.type]}</td>
                  <td className="p-3">{PAGE_LABELS[s.page]}</td>
                  <td className="p-3">
                    {PLACEMENT_LABELS[s.placement]}
                    {s.placement === "main_visual_bg" && s.type === "image" && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        히어로
                      </span>
                    )}
                  </td>
                  <td className="p-3">{s.sortOrder}</td>
                  <td className="p-3">{s.isVisible ? "표시" : "숨김"}</td>
                  <td className="p-3">{s.linkType !== "none" ? "있음" : "—"}</td>
                  <td className="p-3 flex gap-2">
                    <Button href={`/admin/page-sections/${s.id}/edit`} label="수정" color="info" small />
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      className="rounded px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
