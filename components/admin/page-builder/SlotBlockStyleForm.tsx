"use client";

import { useEffect, useRef, useState } from "react";
import { mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import type { PageSection } from "@/types/page-section";
import Button from "@/components/admin/_components/Button";
import type {
  SlotBlockCardColumns,
  SlotBlockCardStyle,
} from "@/lib/slot-block-card-style";
import {
  mergeSlotBlockCardIntoSectionStyleJson,
  resolveSlotBlockCardStyle,
  slotBlockCardSurfaceClasses,
} from "@/lib/slot-block-card-style";
import type { SlotBlockLayout, SlotBlockMotion, SlotBlockMotionSpeed } from "@/lib/slot-block-layout-motion";
import {
  mergeSlotBlockFrameIntoSectionStyleJson,
  resolveSlotBlockLayout,
  resolveSlotBlockMotion,
} from "@/lib/slot-block-layout-motion";
import { resolveSectionStyle } from "@/lib/section-style";
import { AdminColorField } from "@/components/admin/_components/AdminColorField";
import { cn } from "@/lib/utils";

type Props = {
  section: PageSection;
  styleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (mergedSectionStyleJson: string) => void;
  setBusy: (id: string | null) => void;
  onSaved: (updated: PageSection) => void;
  onClose: () => void;
};

const CARD_STYLES: {
  value: SlotBlockCardStyle["cardStyle"];
  title: string;
  hint: string;
}[] = [
  { value: "flat", title: "플랫", hint: "테두리·그림자 최소" },
  { value: "border", title: "테두리", hint: "얇은 테두리" },
  { value: "shadow", title: "그림자", hint: "부드러운 깊이" },
  { value: "elevated", title: "입체", hint: "떠 있는 카드" },
];

const COLUMN_OPTS: { value: SlotBlockCardColumns; label: string }[] = [
  { value: "carousel", label: "가로 스크롤" },
  { value: 1, label: "1열" },
  { value: 2, label: "2열" },
  { value: 3, label: "3열" },
  { value: 4, label: "4열" },
];

const SIZE_OPTS: { value: SlotBlockCardStyle["cardSize"]; label: string }[] = [
  { value: "small", label: "S" },
  { value: "medium", label: "M" },
  { value: "large", label: "L" },
];

const HOVER_OPTS: {
  value: SlotBlockCardStyle["hoverEffect"];
  title: string;
  desc: string;
}[] = [
  { value: "none", title: "없음", desc: "호버 시 변화 없음" },
  { value: "lift", title: "살짝 올림", desc: "포인터 시 카드가 위로" },
  { value: "shadow", title: "그림자 강조", desc: "포인터 시 그림자 진해짐" },
  { value: "scale", title: "살짝 확대", desc: "포인터 시 약간 확대" },
];

const GAP_OPTS: { value: SlotBlockCardStyle["cardGap"]; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "xs", label: "아주 좁게" },
  { value: "sm", label: "좁게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "넓게" },
  { value: "xl", label: "아주 넓게" },
];

const RADIUS_OPTS: { value: SlotBlockCardStyle["borderRadius"]; label: string }[] = [
  { value: "none", label: "각진" },
  { value: "sm", label: "아주 작게" },
  { value: "md", label: "작게" },
  { value: "lg", label: "중간" },
  { value: "xl", label: "크게" },
  { value: "2xl", label: "아주 크게" },
  { value: "full", label: "완전 둥글게" },
];

const RATIO_OPTS: { value: SlotBlockCardStyle["thumbnailRatio"]; label: string }[] = [
  { value: "16:9", label: "16:9" },
  { value: "4:3", label: "4:3" },
  { value: "1:1", label: "1:1 정사각" },
  { value: "3:4", label: "3:4 세로" },
  { value: "5:2", label: "5:2 포스터" },
];

const CLAMP_OPTS: { value: SlotBlockCardStyle["textLineClamp"]; label: string }[] = [
  { value: 0, label: "제한 없음" },
  { value: 1, label: "1줄" },
  { value: 2, label: "2줄" },
  { value: 3, label: "3줄" },
  { value: 4, label: "4줄" },
];

function choiceWrapClass(selected: boolean) {
  return cn(
    "flex flex-col items-stretch rounded-lg border text-left transition-colors",
    selected
      ? "border-site-primary bg-site-primary/10 ring-2 ring-site-primary/25 dark:ring-site-primary/35"
      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
  );
}

function LayoutGlyph({ columns }: { columns: SlotBlockCardColumns }) {
  const dot = "rounded-[2px] bg-gray-600 dark:bg-slate-300";
  if (columns === "carousel") {
    return (
      <div className="flex h-9 w-full items-center justify-center gap-0.5 text-gray-600 dark:text-slate-300" aria-hidden>
        <div className={cn(dot, "h-6 w-2")} />
        <div className={cn(dot, "h-6 w-2")} />
        <div className={cn(dot, "h-6 w-2")} />
      </div>
    );
  }
  if (columns === 4) {
    return (
      <div className="grid h-9 w-full grid-cols-2 gap-0.5 p-1 text-gray-600 dark:text-slate-300" aria-hidden>
        <div className={cn(dot, "h-3.5")} />
        <div className={cn(dot, "h-3.5")} />
        <div className={cn(dot, "h-3.5")} />
        <div className={cn(dot, "h-3.5")} />
      </div>
    );
  }
  const n = columns;
  return (
    <div
      className="grid h-9 w-full gap-0.5 p-1 text-gray-600 dark:text-slate-300"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={cn(dot, "min-h-[1.25rem]")} />
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
      {children}
    </div>
  );
}

export function SlotBlockStyleForm({
  section,
  styleMergeBase,
  onSlotSectionStyleDraft,
  setBusy,
  onSaved,
  onClose,
}: Props) {
  const onDraftRef = useRef(onSlotSectionStyleDraft);
  onDraftRef.current = onSlotSectionStyleDraft;

  const [card, setCard] = useState<SlotBlockCardStyle>(() =>
    resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson)
  );
  const [layout, setLayout] = useState<SlotBlockLayout>(() => {
    const c = resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson);
    return resolveSlotBlockLayout(section.sectionStyleJson, c);
  });
  const [motion, setMotion] = useState<SlotBlockMotion>(() =>
    resolveSlotBlockMotion(section.sectionStyleJson)
  );
  const [blockBg, setBlockBg] = useState(() => resolveSectionStyle(section).backgroundColor ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const c = resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson);
    setCard(c);
    setLayout(resolveSlotBlockLayout(section.sectionStyleJson, c));
    setMotion(resolveSlotBlockMotion(section.sectionStyleJson));
    setBlockBg(resolveSectionStyle(section).backgroundColor ?? "");
  }, [section.id, section.sectionStyleJson, section.backgroundColor, section.slotType]);

  useEffect(() => {
    const base = styleMergeBase ?? section.sectionStyleJson;
    let merged = mergeSlotBlockCardIntoSectionStyleJson(base, card);
    merged = mergeSlotBlockFrameIntoSectionStyleJson(merged, {
      slotBlockLayout: layout,
      slotBlockMotion: motion,
      backgroundColor: blockBg.trim() ? blockBg.trim() : null,
    });
    onDraftRef.current(merged);
  }, [card, layout, motion, blockBg, styleMergeBase, section.sectionStyleJson]);

  const patch = <K extends keyof SlotBlockCardStyle>(key: K, value: SlotBlockCardStyle[K]) => {
    setCard((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setBusy(section.id);
    try {
      const res = await fetch("/api/admin/content/page-layout", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updateStructure",
          id: section.id,
          slotBlockCard: card,
          slotBlockLayout: layout,
          slotBlockMotion: motion,
          backgroundColor: blockBg.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      onSaved(data as PageSection);
      onClose();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-600 dark:text-slate-400">
        이 블록에 포함된 카드들에 <strong>공통</strong>으로 적용됩니다. 선택 즉시 오른쪽 미리보기에 반영됩니다.
      </p>

      <div className="space-y-2 rounded border border-dashed border-amber-400/80 bg-amber-50/60 p-2 text-xs dark:border-amber-800 dark:bg-amber-950/30">
        <div className="font-semibold text-amber-950 dark:text-amber-100">블록 · 레이아웃 · 모션 (검증용 최소)</div>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-600 dark:text-slate-400">레이아웃 방식</span>
          <select
            className="rounded border border-gray-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
            value={layout.type}
            onChange={(e) =>
              setLayout((prev) => ({ ...prev, type: e.target.value as SlotBlockLayout["type"] }))
            }
          >
            <option value="grid">grid</option>
            <option value="carousel">carousel</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-600 dark:text-slate-400">열 개수 (그리드)</span>
          <select
            className="rounded border border-gray-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
            value={layout.columns}
            onChange={(e) =>
              setLayout((prev) => ({
                ...prev,
                columns: Number(e.target.value) as SlotBlockLayout["columns"],
              }))
            }
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={motion.autoPlay}
            onChange={(e) => setMotion((prev) => ({ ...prev, autoPlay: e.target.checked }))}
          />
          자동 재생 (캐러셀)
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-gray-600 dark:text-slate-400">속도</span>
          <select
            className="rounded border border-gray-300 bg-white px-1 py-1 dark:border-slate-600 dark:bg-slate-900"
            value={motion.speed}
            onChange={(e) =>
              setMotion((prev) => ({ ...prev, speed: e.target.value as SlotBlockMotionSpeed }))
            }
          >
            <option value="slow">slow</option>
            <option value="normal">normal</option>
            <option value="fast">fast</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={motion.pauseOnHover}
            onChange={(e) => setMotion((prev) => ({ ...prev, pauseOnHover: e.target.checked }))}
          />
          호버 시 멈춤
        </label>
        <AdminColorField
          label="블록 배경색 (sectionStyleJson)"
          value={blockBg.trim() ? blockBg : null}
          onChange={(hex) => setBlockBg(hex ?? "")}
          nullable
        />
      </div>

      <div className="space-y-5 rounded-lg border border-gray-100 bg-white/60 p-3 dark:border-slate-700/80 dark:bg-slate-900/40">
        <section>
          <FieldLabel>카드 스타일</FieldLabel>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CARD_STYLES.map(({ value, title, hint }) => {
              const sel = card.cardStyle === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch("cardStyle", value)}
                  className={cn(choiceWrapClass(sel), "overflow-hidden p-2")}
                >
                  <div
                    className={cn(
                      "mb-1.5 h-11 w-full rounded-md",
                      slotBlockCardSurfaceClasses(value),
                      "pointer-events-none"
                    )}
                  />
                  <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</div>
                  <div className="mt-0.5 text-[10px] leading-tight text-gray-500 dark:text-slate-400">{hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <FieldLabel>레이아웃</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {COLUMN_OPTS.map(({ value, label }) => {
              const sel = card.columns === value;
              return (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() => patch("columns", value)}
                  className={cn(choiceWrapClass(sel), "min-w-[5.5rem] max-w-[7rem] flex-1 p-2")}
                >
                  <LayoutGlyph columns={value} />
                  <div className="mt-1 text-center text-[11px] font-medium text-gray-800 dark:text-slate-200">
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <FieldLabel>카드 크기</FieldLabel>
          <div className="flex gap-2">
            {SIZE_OPTS.map(({ value, label }) => {
              const sel = card.cardSize === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch("cardSize", value)}
                  className={cn(
                    choiceWrapClass(sel),
                    "min-h-[2.75rem] min-w-[3.25rem] flex-1 items-center justify-center py-2 text-sm font-bold text-gray-900 dark:text-slate-100"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <FieldLabel>마우스 효과</FieldLabel>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {HOVER_OPTS.map(({ value, title, desc }) => {
              const sel = card.hoverEffect === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch("hoverEffect", value)}
                  className={cn(choiceWrapClass(sel), "px-3 py-2")}
                >
                  <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-slate-400">{desc}</div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="rounded-lg border border-dashed border-gray-200 dark:border-slate-600">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-800 dark:text-slate-200"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
        >
          <span>고급 옵션</span>
          <Icon
            path={mdiChevronDown}
            size={0.9}
            className={cn("text-gray-500 transition-transform dark:text-slate-400", advancedOpen && "rotate-180")}
          />
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t border-gray-100 px-3 pb-3 pt-3 dark:border-slate-700">
            <section>
              <FieldLabel>간격</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {GAP_OPTS.map(({ value, label }) => {
                  const sel = card.cardGap === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch("cardGap", value)}
                      className={cn(
                        choiceWrapClass(sel),
                        "px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <FieldLabel>둥글기</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_OPTS.map(({ value, label }) => {
                  const sel = card.borderRadius === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch("borderRadius", value)}
                      className={cn(
                        choiceWrapClass(sel),
                        "px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <FieldLabel>이미지 비율</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {RATIO_OPTS.map(({ value, label }) => {
                  const sel = card.thumbnailRatio === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch("thumbnailRatio", value)}
                      className={cn(
                        choiceWrapClass(sel),
                        "px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <FieldLabel>텍스트 줄 수</FieldLabel>
              <div className="flex flex-wrap gap-1.5">
                {CLAMP_OPTS.map(({ value, label }) => {
                  const sel = card.textLineClamp === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => patch("textLineClamp", value)}
                      className={cn(
                        choiceWrapClass(sel),
                        "px-2.5 py-1.5 text-[11px] font-medium text-gray-800 dark:text-slate-200"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button label="스타일 저장" color="info" small onClick={() => void save()} />
        <Button label="닫기" color="contrast" small onClick={onClose} />
      </div>
    </div>
  );
}
