"use client";

import Button from "@/components/admin/_components/Button";
import type { HomeStructureSlotType } from "@/lib/home-structure-slots";
import type { SlotBlockItemsBundle, SlotBlockManualItem, SlotBlockManualEntryRole } from "@/lib/slot-block-items";
import {
  defaultNanguManualPair,
  emptyManualItem,
} from "@/lib/slot-block-items";
import { decorateChoiceWrapClass } from "@/components/admin/page-builder/slot-decorate/decorateChoice";
import { cn } from "@/lib/utils";

type Props = {
  slotType: HomeStructureSlotType;
  bundle: SlotBlockItemsBundle;
  onChange: (next: SlotBlockItemsBundle) => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-semibold text-gray-600 dark:text-slate-400">{children}</div>;
}

function ItemEditor({
  item,
  slotType,
  onPatch,
}: {
  item: SlotBlockManualItem;
  slotType: HomeStructureSlotType;
  onPatch: (patch: Partial<SlotBlockManualItem>) => void;
}) {
  const showButtonLabel = slotType === "venueLink";
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/50">
      <div>
        <FieldLabel>제목</FieldLabel>
        <input
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={item.title}
          onChange={(e) => onPatch({ title: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>설명</FieldLabel>
        <textarea
          className="min-h-[4rem] w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={item.description ?? ""}
          onChange={(e) => onPatch({ description: e.target.value })}
        />
      </div>
      <div>
        <FieldLabel>이미지 주소 (URL)</FieldLabel>
        <input
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={item.imageUrl ?? ""}
          onChange={(e) => onPatch({ imageUrl: e.target.value || null })}
          placeholder="https://…"
        />
      </div>
      <div>
        <FieldLabel>링크 (사이트 안 경로 또는 https://)</FieldLabel>
        <input
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={item.linkUrl ?? ""}
          onChange={(e) => onPatch({ linkUrl: e.target.value })}
          placeholder="/tournaments"
        />
      </div>
      {showButtonLabel ? (
        <div>
          <FieldLabel>보조 문구 (선택)</FieldLabel>
          <input
            className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={item.buttonLabel ?? ""}
            onChange={(e) => onPatch({ buttonLabel: e.target.value })}
            placeholder="예: 자세히 보기"
          />
        </div>
      ) : null}
    </div>
  );
}

export function DecorateSlotBlockItemsEditor({ slotType, bundle, onChange }: Props) {
  const setMode = (mode: "auto" | "manual") => {
    if (mode === "auto") {
      onChange({ mode: "auto", items: [] });
      return;
    }
    if (slotType === "nanguEntry") {
      onChange({
        mode: "manual",
        items:
          bundle.items.length >= 2 && bundle.mode === "manual"
            ? bundle.items
            : defaultNanguManualPair(),
      });
      return;
    }
    const seed = bundle.items.length > 0 && bundle.mode === "manual" ? bundle.items : [emptyManualItem(slotType)];
    onChange({ mode: "manual", items: seed });
  };

  const updateAt = (id: string, patch: Partial<SlotBlockManualItem>) => {
    onChange({
      ...bundle,
      items: bundle.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  };

  const updateNanguRole = (role: SlotBlockManualEntryRole, patch: Partial<SlotBlockManualItem>) => {
    onChange({
      ...bundle,
      items: bundle.items.map((i) => (i.entryRole === role ? { ...i, ...patch } : i)),
    });
  };

  const addItem = () => {
    onChange({
      ...bundle,
      items: [...bundle.items, emptyManualItem(slotType)],
    });
  };

  const removeItem = (id: string) => {
    if (slotType === "nanguEntry") return;
    onChange({ ...bundle, items: bundle.items.filter((i) => i.id !== id) });
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (slotType === "nanguEntry") return;
    const j = index + dir;
    if (j < 0 || j >= bundle.items.length) return;
    const next = [...bundle.items];
    [next[index], next[j]] = [next[j], next[index]];
    onChange({ ...bundle, items: next });
  };

  const nanguNotes = bundle.items.find((i) => i.entryRole === "nanguNotes");
  const nanguSolver = bundle.items.find((i) => i.entryRole === "nanguSolver");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("auto")}
          className={cn(
            decorateChoiceWrapClass(bundle.mode === "auto"),
            "min-h-[2.5rem] flex-1 px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-slate-100"
          )}
        >
          자동 연결
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            decorateChoiceWrapClass(bundle.mode === "manual"),
            "min-h-[2.5rem] flex-1 px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-slate-100"
          )}
        >
          직접 구성
        </button>
      </div>

      {bundle.mode === "manual" && slotType === "nanguEntry" && nanguNotes && nanguSolver ? (
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-800 dark:text-slate-200">난구노트 카드</div>
            <ItemEditor
              item={nanguNotes}
              slotType={slotType}
              onPatch={(p) => updateNanguRole("nanguNotes", p)}
            />
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-800 dark:text-slate-200">난구해결사 카드</div>
            <ItemEditor
              item={nanguSolver}
              slotType={slotType}
              onPatch={(p) => updateNanguRole("nanguSolver", p)}
            />
          </div>
        </div>
      ) : null}

      {bundle.mode === "manual" && slotType !== "nanguEntry" ? (
        <div className="space-y-3">
          {bundle.items.map((it, index) => (
            <div key={it.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-gray-500 dark:text-slate-400">
                  카드 {index + 1}
                </span>
                <div className="flex flex-wrap gap-1">
                  <Button
                    label="위로"
                    color="contrast"
                    small
                    disabled={index === 0}
                    onClick={() => moveItem(index, -1)}
                  />
                  <Button
                    label="아래로"
                    color="contrast"
                    small
                    disabled={index === bundle.items.length - 1}
                    onClick={() => moveItem(index, 1)}
                  />
                  <Button label="삭제" color="contrast" small onClick={() => removeItem(it.id)} />
                </div>
              </div>
              <ItemEditor item={it} slotType={slotType} onPatch={(p) => updateAt(it.id, p)} />
            </div>
          ))}
          <Button label="카드 추가" color="info" small onClick={addItem} />
        </div>
      ) : null}
    </div>
  );
}
