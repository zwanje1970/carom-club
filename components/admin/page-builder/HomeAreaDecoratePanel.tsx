"use client";

import { mdiChevronDown } from "@mdi/js";
import Icon from "@mdi/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PageSection, PlacementSlug } from "@/types/page-section";
import Button from "@/components/admin/_components/Button";
import { AdminColorField } from "@/components/admin/_components/AdminColorField";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import {
  mergeSlotBlockCardIntoSectionStyleJson,
  resolveSlotBlockCardStyle,
} from "@/lib/slot-block-card-style";
import type { SlotBlockLayout, SlotBlockMotion, SlotBlockMotionSpeed } from "@/lib/slot-block-layout-motion";
import {
  cardStyleWithResolvedLayout,
  mergeSlotBlockFrameIntoSectionStyleJson,
  resolveSlotBlockLayout,
  resolveSlotBlockMotion,
} from "@/lib/slot-block-layout-motion";
import {
  mergeSlotBlockCtaIntoSectionStyleJson,
  resolveSlotBlockCtaConfig,
  rolesForSlotType,
  sanitizeCtaLayerForRole,
} from "@/lib/slot-block-cta";
import type { SlotBlockCtaConfig, SlotBlockCtaLayer, SlotBlockCtaLayerRole } from "@/lib/slot-block-cta";
import { resolveSectionStyle } from "@/lib/section-style";
import { getHomeSlotContentGuide } from "@/lib/home-slot-content-guide";
import type { HomeStructureSlotType } from "@/lib/home-structure-slots";
import {
  mergeSlotBlockItemsIntoSectionStyleJson,
  parseSlotBlockItemsBundle,
  type SlotBlockItemsBundle,
} from "@/lib/slot-block-items";
import { PLACEMENT_LABELS } from "@/lib/content/constants";
import { cn } from "@/lib/utils";
import { decorateChoiceWrapClass } from "@/components/admin/page-builder/slot-decorate/decorateChoice";
import { DecorateCardAppearance } from "@/components/admin/page-builder/slot-decorate/DecorateCardAppearance";
import { SlotBlockDecorateCtaPanel } from "@/components/admin/page-builder/slot-decorate/DecorateCtaLayers";
import { DecorateSlotBlockItemsEditor } from "@/components/admin/page-builder/slot-decorate/DecorateSlotBlockItemsEditor";

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

function LayoutGlyph({ columns }: { columns: 1 | 2 | 3 | 4 }) {
  const dot = "rounded-[2px] bg-gray-600 dark:bg-slate-300";
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

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-gray-100 bg-white/80 p-3 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">{title}</h3>
      {children}
    </section>
  );
}

type Props = {
  section: PageSection;
  styleMergeBase: string | null | undefined;
  onSlotSectionStyleDraft: (mergedSectionStyleJson: string) => void;
  setBusy: (id: string | null) => void;
  onSaved: (updated: PageSection) => void;
  onClose: () => void;
};

const GAP_QUICK: { value: SlotBlockCardStyle["cardGap"]; label: string }[] = [
  { value: "none", label: "없음" },
  { value: "sm", label: "좁게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "넓게" },
];

export function HomeAreaDecoratePanel({
  section,
  styleMergeBase,
  onSlotSectionStyleDraft,
  setBusy,
  onSaved,
  onClose,
}: Props) {
  const onDraftRef = useRef(onSlotSectionStyleDraft);
  onDraftRef.current = onSlotSectionStyleDraft;

  const slotType = section.slotType as HomeStructureSlotType;
  const roles = useMemo(() => rolesForSlotType(slotType), [slotType]);
  const contentGuide = useMemo(() => getHomeSlotContentGuide(slotType), [slotType]);

  const [card, setCard] = useState<SlotBlockCardStyle>(() =>
    resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson)
  );
  const [layout, setLayout] = useState<SlotBlockLayout>(() => {
    const c = resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson);
    return resolveSlotBlockLayout(section.sectionStyleJson, c);
  });
  const [motion, setMotion] = useState<SlotBlockMotion>(() => resolveSlotBlockMotion(section.sectionStyleJson));
  const [blockBg, setBlockBg] = useState(() => resolveSectionStyle(section).backgroundColor ?? "");
  const [cfg, setCfg] = useState<SlotBlockCtaConfig>(() =>
    resolveSlotBlockCtaConfig(section.slotType, section.sectionStyleJson)
  );
  const [placement, setPlacement] = useState<PlacementSlug>(section.placement);
  const [startLocal, setStartLocal] = useState(() => isoToDatetimeLocal(section.startAt));
  const [endLocal, setEndLocal] = useState(() => isoToDatetimeLocal(section.endAt));
  const [itemsBundle, setItemsBundle] = useState<SlotBlockItemsBundle>(() =>
    parseSlotBlockItemsBundle(section.sectionStyleJson, slotType)
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const c = resolveSlotBlockCardStyle(section.slotType, section.sectionStyleJson);
    setCard(c);
    setLayout(resolveSlotBlockLayout(section.sectionStyleJson, c));
    setMotion(resolveSlotBlockMotion(section.sectionStyleJson));
    setBlockBg(resolveSectionStyle(section).backgroundColor ?? "");
    setCfg(resolveSlotBlockCtaConfig(section.slotType, section.sectionStyleJson));
    setPlacement(section.placement);
    setStartLocal(isoToDatetimeLocal(section.startAt));
    setEndLocal(isoToDatetimeLocal(section.endAt));
    setItemsBundle(parseSlotBlockItemsBundle(section.sectionStyleJson, slotType));
  }, [section.id, section.sectionStyleJson, section.backgroundColor, section.slotType, section.placement, section.startAt, section.endAt]);

  useEffect(() => {
    setCard((prev) => cardStyleWithResolvedLayout(prev, layout));
  }, [layout.type, layout.columns]);

  useEffect(() => {
    const base = styleMergeBase ?? section.sectionStyleJson;
    const cardMerged = cardStyleWithResolvedLayout(card, layout);
    let merged = mergeSlotBlockCardIntoSectionStyleJson(base, cardMerged);
    merged = mergeSlotBlockFrameIntoSectionStyleJson(merged, {
      slotBlockLayout: layout,
      slotBlockMotion: motion,
      backgroundColor: blockBg.trim() ? blockBg.trim() : null,
    });
    merged = mergeSlotBlockCtaIntoSectionStyleJson(merged, cfg);
    merged = mergeSlotBlockItemsIntoSectionStyleJson(merged, itemsBundle);
    onDraftRef.current(merged);
  }, [card, layout, motion, blockBg, cfg, itemsBundle, styleMergeBase, section.sectionStyleJson]);

  const patchCard = <K extends keyof SlotBlockCardStyle>(key: K, value: SlotBlockCardStyle[K]) => {
    setCard((prev) => ({ ...prev, [key]: value }));
  };

  const updateCtaRole = (role: SlotBlockCtaLayerRole, layer: SlotBlockCtaLayer) => {
    setCfg((prev) => ({
      ...prev,
      [role]: sanitizeCtaLayerForRole(layer, role),
    }));
  };

  const save = async () => {
    const sanitized: SlotBlockCtaConfig = { ...cfg };
    for (const r of roles) {
      const L = sanitized[r];
      if (L) sanitized[r] = sanitizeCtaLayerForRole(L, r);
    }
    const cardOut = cardStyleWithResolvedLayout(card, layout);
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
          slotBlockCard: cardOut,
          slotBlockLayout: layout,
          slotBlockMotion: motion,
          backgroundColor: blockBg.trim() || null,
          slotBlockCta: sanitized,
          slotBlockItems:
            itemsBundle.mode === "auto"
              ? null
              : {
                  mode: "manual",
                  items: itemsBundle.items.map((i) => ({
                    id: i.id,
                    title: i.title,
                    description: i.description ?? "",
                    imageUrl: i.imageUrl ?? null,
                    linkUrl: i.linkUrl ?? "",
                    buttonLabel: i.buttonLabel ?? "",
                    ...(i.entryRole ? { entryRole: i.entryRole } : {}),
                  })),
                },
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

  const setLayoutType = (type: SlotBlockLayout["type"]) => {
    setLayout((prev) => ({ ...prev, type }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">이 영역 꾸미기</h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-slate-400">
          보이는 화면 기준으로 한 번에 조정합니다. 오른쪽 미리보기에 저장 전에도 바로 반영됩니다.
        </p>
      </div>

      <div className="max-h-[min(78vh,720px)] space-y-4 overflow-y-auto pr-1">
        <SectionShell title="레이아웃">
          <div>
            <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">표시 방식</div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setLayoutType("grid")}
                className={cn(
                  decorateChoiceWrapClass(layout.type === "grid"),
                  "min-h-[3rem] flex-1 px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-slate-100"
                )}
              >
                <span className="block font-semibold">격자</span>
                <span className="mt-0.5 block text-[10px] font-normal text-gray-500 dark:text-slate-400">
                  여러 열로 정돈
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutType("carousel")}
                className={cn(
                  decorateChoiceWrapClass(layout.type === "carousel"),
                  "min-h-[3rem] flex-1 px-3 py-2 text-left text-xs font-medium text-gray-900 dark:text-slate-100"
                )}
              >
                <span className="block font-semibold">가로 흐름</span>
                <span className="mt-0.5 block text-[10px] font-normal text-gray-500 dark:text-slate-400">
                  옆으로 넘기기
                </span>
              </button>
            </div>
          </div>

          {layout.type === "grid" ? (
            <div>
              <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">열 개수</div>
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3, 4] as const).map((n) => {
                  const sel = layout.columns === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setLayout((prev) => ({ ...prev, columns: n }))}
                      className={cn(decorateChoiceWrapClass(sel), "min-w-[4.5rem] flex-1 p-2")}
                    >
                      <LayoutGlyph columns={n} />
                      <div className="mt-1 text-center text-[11px] font-medium text-gray-800 dark:text-slate-200">
                        {n}열
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              가로 흐름은 한 줄 스트립으로 보입니다. 열 수는 격자일 때만 적용됩니다.
            </p>
          )}

          <div>
            <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">카드 사이 간격</div>
            <div className="flex flex-wrap gap-1.5">
              {GAP_QUICK.map(({ value, label }) => {
                const sel = card.cardGap === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => patchCard("cardGap", value)}
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
            <p className="mt-1 text-[10px] text-gray-500 dark:text-slate-500">
              더 세밀한 간격은 아래 「카드 모양」의 세부 모양에서 고를 수 있습니다.
            </p>
          </div>

          <AdminColorField
            label="이 영역 배경색"
            value={blockBg.trim() ? blockBg : null}
            onChange={(hex) => setBlockBg(hex ?? "")}
            nullable
          />
        </SectionShell>

        <SectionShell title="카드 모양">
          <DecorateCardAppearance card={card} onPatch={patchCard} />
        </SectionShell>

        <SectionShell title="움직임">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMotion((m) => ({ ...m, autoPlay: true }))}
              className={cn(
                decorateChoiceWrapClass(motion.autoPlay),
                "min-h-[2.5rem] flex-1 px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
              )}
            >
              자동 이동 켜기
            </button>
            <button
              type="button"
              onClick={() => setMotion((m) => ({ ...m, autoPlay: false }))}
              className={cn(
                decorateChoiceWrapClass(!motion.autoPlay),
                "min-h-[2.5rem] flex-1 px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
              )}
            >
              자동 이동 끄기
            </button>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-slate-300">속도</div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "slow" as const, label: "느리게" },
                  { value: "normal" as const, label: "보통" },
                  { value: "fast" as const, label: "빠르게" },
                ] satisfies { value: SlotBlockMotionSpeed; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMotion((m) => ({ ...m, speed: value }))}
                  className={cn(
                    decorateChoiceWrapClass(motion.speed === value),
                    "min-h-[2.5rem] flex-1 px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMotion((m) => ({ ...m, pauseOnHover: true }))}
              className={cn(
                decorateChoiceWrapClass(motion.pauseOnHover),
                "min-h-[2.5rem] flex-1 px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
              )}
            >
              마우스 올리면 멈춤
            </button>
            <button
              type="button"
              onClick={() => setMotion((m) => ({ ...m, pauseOnHover: false }))}
              className={cn(
                decorateChoiceWrapClass(!motion.pauseOnHover),
                "min-h-[2.5rem] flex-1 px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
              )}
            >
              멈추지 않음
            </button>
          </div>

        </SectionShell>

        <SectionShell title="클릭 동작">
          <SlotBlockDecorateCtaPanel roles={roles} cfg={cfg} onLayerChange={updateCtaRole} />
        </SectionShell>

        <SectionShell title="카드 내용">
          <DecorateSlotBlockItemsEditor slotType={slotType} bundle={itemsBundle} onChange={setItemsBundle} />
          {itemsBundle.mode === "auto" ? (
            <div className="rounded-md border border-sky-200/80 bg-sky-50/50 p-2 text-[11px] leading-relaxed text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
              <p>{contentGuide.summary}</p>
              <ul className="mt-2 space-y-1">
                {contentGuide.links.map((l) => (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      className="font-medium text-site-primary underline hover:opacity-90"
                      target={l.href.startsWith("/community") ? "_blank" : undefined}
                      rel={l.href.startsWith("/community") ? "noreferrer" : undefined}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[10px] text-gray-500 dark:text-slate-500">
              카드에 링크를 넣으면 그 주소로 이동합니다. 비우면 「클릭 동작」의 카드 설정을 따릅니다.
            </p>
          )}
        </SectionShell>

        <div className="rounded-lg border border-dashed border-gray-200 dark:border-slate-600">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-gray-800 dark:text-slate-200"
            onClick={() => setAdvancedOpen((o) => !o)}
            aria-expanded={advancedOpen}
          >
            <span>고급 설정 · 페이지에 표시되는 위치와 기간</span>
            <Icon
              path={mdiChevronDown}
              size={0.9}
              className={cn("text-gray-500 transition-transform dark:text-slate-400", advancedOpen && "rotate-180")}
            />
          </button>
          {advancedOpen ? (
            <div className="space-y-3 border-t border-gray-100 px-3 pb-3 pt-3 dark:border-slate-700">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400">노출 위치</span>
                <select
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
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
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">노출 시작</span>
                  <input
                    type="datetime-local"
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    value={startLocal}
                    onChange={(e) => setStartLocal(e.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-slate-400">노출 종료</span>
                  <input
                    type="datetime-local"
                    className="rounded border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                    value={endLocal}
                    onChange={(e) => setEndLocal(e.target.value)}
                  />
                </label>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-500">비우면 기간 제한 없음으로 저장됩니다.</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 dark:border-slate-700">
        <Button label="이 영역 설정 저장" color="info" small onClick={() => void save()} />
        <Button label="닫기" color="contrast" small onClick={onClose} />
      </div>
    </div>
  );
}
