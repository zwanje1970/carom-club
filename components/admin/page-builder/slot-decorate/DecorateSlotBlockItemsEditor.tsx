"use client";

import Button from "@/components/admin/_components/Button";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import type { HomeStructureSlotType } from "@/lib/home-structure-slots";
import type {
  SlotBlockItemsBundle,
  SlotBlockManualItem,
  SlotBlockManualEntryRole,
  SlotBlockPublishedType,
} from "@/lib/slot-block-items";
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
  tournamentAutoSettings?: {
    displayCount: number;
    onChangeDisplayCount: (next: number) => void;
  };
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
        <FieldLabel>이미지 첨부 (권장)</FieldLabel>
        <AdminImageField
          label="카드 이미지"
          value={item.imageUrl ?? null}
          onChange={(url) => onPatch({ imageUrl: url ?? null })}
          policy="section"
          recommendedSize="1200x675"
        />
        <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-500">
          권장 크기 1200x675 · 최대 용량 2MB · JPG/PNG/WEBP · 비율이 다르면 잘릴 수 있습니다.
        </p>
      </div>
      <div>
        <FieldLabel>이미지 URL (보조 입력)</FieldLabel>
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

export function DecorateSlotBlockItemsEditor({
  slotType,
  bundle,
  onChange,
  tournamentAutoSettings,
}: Props) {
  const canChoosePublishedType = slotType === "tournamentIntro" || slotType === "venueIntro";
  const publishedTypeLabel = bundle.publishedType === "venue" ? "당구장 홍보용 게시카드" : "대회용 게시카드";

  const setMode = (mode: "auto" | "manual") => {
    if (mode === "auto") {
      onChange({ ...bundle, mode: "auto", items: [] });
      return;
    }
    if (slotType === "nanguEntry") {
      onChange({
        mode: "manual",
        publishedType: bundle.publishedType,
        items:
          bundle.items.length >= 2 && bundle.mode === "manual"
            ? bundle.items
            : defaultNanguManualPair(),
      });
      return;
    }
    const seed = bundle.items.length > 0 && bundle.mode === "manual" ? bundle.items : [emptyManualItem(slotType)];
    onChange({ ...bundle, mode: "manual", items: seed });
  };

  const setPublishedType = (next: SlotBlockPublishedType) => {
    if (!canChoosePublishedType) return;
    onChange({ ...bundle, publishedType: next });
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
          자동 데이터 연결 사용함
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={cn(
            decorateChoiceWrapClass(bundle.mode === "manual"),
            "min-h-[2.5rem] flex-1 px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-slate-100"
          )}
        >
          자동 데이터 연결 사용 안 함
        </button>
      </div>

      {bundle.mode === "auto" ? (
        <div className="space-y-2 rounded-lg border border-sky-200/80 bg-sky-50/60 p-3 dark:border-sky-800 dark:bg-sky-950/30">
          <div className="text-[11px] font-semibold text-sky-950 dark:text-sky-100">자동 데이터 연결 설정</div>
          {slotType === "tournamentIntro" ? (
            <>
              <div>
                <FieldLabel>데이터 종류</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPublishedType("tournament")}
                    className={cn(
                      decorateChoiceWrapClass(true),
                      "min-h-[2.25rem] px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-slate-100"
                    )}
                  >
                    대회카드
                  </button>
                </div>
              </div>
              <div>
                <FieldLabel>불러올 개수</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {[4, 6, 8].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => tournamentAutoSettings?.onChangeDisplayCount(n)}
                      className={cn(
                        decorateChoiceWrapClass((tournamentAutoSettings?.displayCount ?? 6) === n),
                        "min-h-[2.25rem] px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-slate-100"
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>정렬 방식</FieldLabel>
                <div className="rounded border border-sky-200 bg-sky-100/60 px-2.5 py-1.5 text-xs font-semibold text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                  최신순 (고정)
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-200">
                발행된 대회카드 기준으로 최신 카드가 선택 개수만큼 자동 반영됩니다.
              </p>
            </>
          ) : canChoosePublishedType ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setPublishedType("tournament")}
                  className={cn(
                    decorateChoiceWrapClass(bundle.publishedType === "tournament"),
                    "min-h-[2.25rem] px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-slate-100"
                  )}
                >
                  대회용 게시카드
                </button>
                <button
                  type="button"
                  onClick={() => setPublishedType("venue")}
                  className={cn(
                    decorateChoiceWrapClass(bundle.publishedType === "venue"),
                    "min-h-[2.25rem] px-3 py-1.5 text-xs font-semibold text-gray-900 dark:text-slate-100"
                  )}
                >
                  당구장 홍보용 게시카드
                </button>
              </div>
              <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-200">
                현재 블록은 <span className="font-semibold">{publishedTypeLabel}</span>를 메인에 저장된 게시 스냅샷 기준으로 렌더링합니다.
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-sky-900 dark:text-sky-200">
              이 블록은 게시카드 자동 불러오기만 지원합니다.
            </p>
          )}
        </div>
      ) : null}

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
