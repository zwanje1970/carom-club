"use client";

import { mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import { useState } from "react";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { slotBlockCardSurfaceClasses } from "@/lib/slot-block-card-style";
import { cn } from "@/lib/utils";
import { decorateChoiceWrapClass } from "./decorateChoice";

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

const SIZE_OPTS: { value: SlotBlockCardStyle["cardSize"]; label: string }[] = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "크게" },
];

const HOVER_OPTS: {
  value: SlotBlockCardStyle["hoverEffect"];
  title: string;
  desc: string;
}[] = [
  { value: "none", title: "없음", desc: "포인터 시 변화 없음" },
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

function SubLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">{children}</div>;
}

type Props = {
  card: SlotBlockCardStyle;
  onPatch: <K extends keyof SlotBlockCardStyle>(key: K, value: SlotBlockCardStyle[K]) => void;
};

export function DecorateCardAppearance({ card, onPatch }: Props) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <div className="space-y-5">
      <section>
        <SubLabel>카드 스타일</SubLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CARD_STYLES.map(({ value, title, hint }) => {
            const sel = card.cardStyle === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPatch("cardStyle", value)}
                className={cn(decorateChoiceWrapClass(sel), "overflow-hidden p-2")}
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
        <SubLabel>카드 크기</SubLabel>
        <div className="flex gap-2">
          {SIZE_OPTS.map(({ value, label }) => {
            const sel = card.cardSize === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPatch("cardSize", value)}
                className={cn(
                  decorateChoiceWrapClass(sel),
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
        <SubLabel>마우스를 올렸을 때</SubLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {HOVER_OPTS.map(({ value, title, desc }) => {
            const sel = card.hoverEffect === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => onPatch("hoverEffect", value)}
                className={cn(decorateChoiceWrapClass(sel), "px-3 py-2")}
              >
                <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">{title}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-slate-400">{desc}</div>
              </button>
            );
          })}
        </div>
      </section>

      <div className="rounded-lg border border-dashed border-gray-200 dark:border-slate-600">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-800 dark:text-slate-200"
          onClick={() => setAdvancedOpen((o) => !o)}
          aria-expanded={advancedOpen}
        >
          <span>세부 모양 (간격·모서리·이미지·글 줄 수)</span>
          <Icon
            path={mdiChevronDown}
            size={0.9}
            className={cn("text-gray-500 transition-transform dark:text-slate-400", advancedOpen && "rotate-180")}
          />
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t border-gray-100 px-3 pb-3 pt-3 dark:border-slate-700">
            <section>
              <SubLabel>카드 사이 간격</SubLabel>
              <div className="flex flex-wrap gap-1.5">
                {GAP_OPTS.map(({ value, label }) => {
                  const sel = card.cardGap === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPatch("cardGap", value)}
                      className={cn(
                        decorateChoiceWrapClass(sel),
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
              <SubLabel>모서리 둥글기</SubLabel>
              <div className="flex flex-wrap gap-1.5">
                {RADIUS_OPTS.map(({ value, label }) => {
                  const sel = card.borderRadius === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPatch("borderRadius", value)}
                      className={cn(
                        decorateChoiceWrapClass(sel),
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
              <SubLabel>이미지 비율</SubLabel>
              <div className="flex flex-wrap gap-1.5">
                {RATIO_OPTS.map(({ value, label }) => {
                  const sel = card.thumbnailRatio === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPatch("thumbnailRatio", value)}
                      className={cn(
                        decorateChoiceWrapClass(sel),
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
              <SubLabel>설명 글 최대 줄 수</SubLabel>
              <div className="flex flex-wrap gap-1.5">
                {CLAMP_OPTS.map(({ value, label }) => {
                  const sel = card.textLineClamp === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPatch("textLineClamp", value)}
                      className={cn(
                        decorateChoiceWrapClass(sel),
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
    </div>
  );
}
