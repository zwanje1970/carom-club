"use client";

import { useEffect, useMemo, useState } from "react";
import type { PageSection, PageSlug, PlacementSlug } from "@/types/page-section";
import { PAGE_LABELS, PLACEMENT_LABELS } from "@/lib/content/constants";
import {
  getAllowedBuilderPageOptions,
  type PageBuilderKey,
} from "@/lib/content/page-section-page-rules";
import { isHomeStructureSlotType } from "@/lib/home-structure-slots";
import Button from "@/components/admin/_components/Button";
import { HomeAreaDecoratePanel } from "@/components/admin/page-builder/HomeAreaDecoratePanel";

const PLACEMENT_KEYS = Object.keys(PLACEMENT_LABELS) as PlacementSlug[];

function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function datetimeLocalToIso(v: string): string | null {
  if (!v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export type SectionToolMode = "structure" | "move" | "duplicate";

type Props = {
  mode: SectionToolMode;
  section: PageSection;
  currentPage: PageSlug;
  onClose: () => void;
  onStructureSaved: (updated: PageSection) => void;
  onMovedAway: () => void;
  onDuplicated: (targetPage: PageSlug, sameList: boolean) => void;
  setBusy: (id: string | null) => void;
  /** 스타일/CTA 탭에서 `sectionStyleJson` 미리보기 병합용 베이스(이전 드래프트 또는 서버 값) */
  slotSectionStyleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (json: string) => void;
};

export function SectionRowTools({
  mode,
  section,
  currentPage,
  onClose,
  onStructureSaved,
  onMovedAway,
  onDuplicated,
  setBusy,
  slotSectionStyleMergeBase,
  onSlotSectionStyleDraft,
}: Props) {
  const allowedTargets = useMemo(
    () => getAllowedBuilderPageOptions(section.slotType, section.type),
    [section.slotType, section.type]
  );
  const moveTargets = useMemo(
    () => allowedTargets.filter((p) => p !== currentPage),
    [allowedTargets, currentPage]
  );
  const [placement, setPlacement] = useState<PlacementSlug>(section.placement);
  const [startLocal, setStartLocal] = useState(() => isoToDatetimeLocal(section.startAt));
  const [endLocal, setEndLocal] = useState(() => isoToDatetimeLocal(section.endAt));
  const [moveTo, setMoveTo] = useState<PageBuilderKey>(() => moveTargets[0] ?? currentPage);
  const [dupTo, setDupTo] = useState<PageBuilderKey>(() => allowedTargets[0] ?? currentPage);
  useEffect(() => {
    setPlacement(section.placement);
    setStartLocal(isoToDatetimeLocal(section.startAt));
    setEndLocal(isoToDatetimeLocal(section.endAt));
  }, [section]);

  useEffect(() => {
    setMoveTo(moveTargets[0] ?? currentPage);
  }, [section.id, currentPage, moveTargets]);

  useEffect(() => {
    setDupTo((prev) => (allowedTargets.includes(prev) ? prev : allowedTargets[0] ?? currentPage));
  }, [section.id, currentPage, allowedTargets]);

  const saveStructure = async () => {
    setBusy(section.id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStructure",
          id: section.id,
          placement,
          startAt: datetimeLocalToIso(startLocal),
          endAt: datetimeLocalToIso(endLocal),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      onStructureSaved(data as PageSection);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const runMove = async () => {
    if (!moveTo || moveTo === currentPage) {
      alert("이동할 다른 페이지를 선택하세요.");
      return;
    }
    setBusy(section.id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "moveSection", id: section.id, targetPage: moveTo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "이동에 실패했습니다.");
        return;
      }
      onMovedAway();
      onClose();
    } finally {
      setBusy(null);
    }
  };

  const runDuplicate = async () => {
    setBusy("dup");
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "duplicateSection", id: section.id, targetPage: dupTo }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "복제에 실패했습니다.");
        return;
      }
      onDuplicated(dupTo, dupTo === currentPage);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  if (mode === "structure") {
    const isHomeDecorate = isHomeStructureSlotType(section.slotType);
    if (isHomeDecorate) {
      return (
        <div className="rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
          <HomeAreaDecoratePanel
            section={section}
            styleMergeBase={slotSectionStyleMergeBase}
            onSlotSectionStyleDraft={onSlotSectionStyleDraft}
            setBusy={setBusy}
            onSaved={onStructureSaved}
            onClose={onClose}
          />
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
        <div className="font-medium text-gray-800 dark:text-slate-200">노출 위치와 기간</div>
        <>
          {section.slotType === "hero" ? (
            <p className="text-xs text-amber-900 dark:text-amber-200">
              히어로 <strong>콘텐츠</strong>는「<a href="/admin/site/hero" className="font-medium underline">히어로 설정</a>
              」에서만 바꿉니다. 여기서는 이 슬롯의 <strong>위치·노출 기간</strong>만 저장됩니다.
            </p>
          ) : null}
          <label className="flex flex-col gap-1">
            <span className="text-gray-600 dark:text-slate-400">노출 위치</span>
            <select
              className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
              value={placement}
              onChange={(e) => setPlacement(e.target.value as PlacementSlug)}
            >
              {PLACEMENT_KEYS.map((k) => (
                <option key={k} value={k}>
                  {PLACEMENT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-gray-600 dark:text-slate-400">노출 시작</span>
              <input
                type="datetime-local"
                className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
                value={startLocal}
                onChange={(e) => setStartLocal(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-gray-600 dark:text-slate-400">노출 종료</span>
              <input
                type="datetime-local"
                className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
                value={endLocal}
                onChange={(e) => setEndLocal(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-500">비우면 기간 제한 없음으로 저장됩니다.</p>
          <div className="flex flex-wrap gap-2">
            <Button label="저장" color="info" small onClick={() => void saveStructure()} />
            <Button label="닫기" color="contrast" small onClick={onClose} />
          </div>
        </>
      </div>
    );
  }

  if (mode === "move") {
    if (moveTargets.length === 0) {
      return (
        <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          이 섹션 유형이 허용된 다른 빌더 페이지가 없습니다.
          <button type="button" className="ml-2 underline" onClick={onClose}>
            닫기
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-3 rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
        <div className="font-medium text-gray-800 dark:text-slate-200">다른 페이지로 이동</div>
        <p className="text-xs text-gray-600 dark:text-slate-400">
          허용된 페이지로만 이동할 수 있습니다. 이동 후 목록 맨 아래에 붙습니다.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600 dark:text-slate-400">대상 페이지</span>
          <select
            className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
            value={moveTo}
            onChange={(e) => setMoveTo(e.target.value as PageBuilderKey)}
          >
            {moveTargets.map((p) => (
              <option key={p} value={p}>
                {PAGE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button label="이동" color="info" small onClick={() => void runMove()} />
          <Button label="취소" color="contrast" small onClick={onClose} />
        </div>
      </div>
    );
  }

  /* duplicate */
  return (
    <div className="space-y-3 rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
      <div className="font-medium text-gray-800 dark:text-slate-200">복제</div>
      <p className="text-xs text-gray-600 dark:text-slate-400">
        동일 유형이 허용된 페이지에만 복제할 수 있습니다. 제목에 「(복사)」가 붙습니다.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600 dark:text-slate-400">복제할 페이지</span>
        <select
          className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          value={dupTo}
          onChange={(e) => setDupTo(e.target.value as PageBuilderKey)}
        >
          {allowedTargets.map((p) => (
            <option key={p} value={p}>
              {PAGE_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button label="복제 실행" color="info" small onClick={() => void runDuplicate()} />
        <Button label="취소" color="contrast" small onClick={onClose} />
      </div>
    </div>
  );
}
