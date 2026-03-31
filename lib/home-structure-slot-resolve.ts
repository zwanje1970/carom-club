import type { PageSection } from "@/types/page-section";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { resolveSlotBlockCardStyle } from "@/lib/slot-block-card-style";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import { resolveSlotBlockCtaConfig } from "@/lib/slot-block-cta";
import { isHomeStructureSlotType } from "@/lib/home-structure-slots";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { resolveSlotBlockLayout, resolveSlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { resolveSectionStyle } from "@/lib/section-style";

/** `sectionStyleJson`의 slotBlockCard + slotBlockCta + layout + motion */
export type HomeStructureSlotResolved = {
  cardStyle: SlotBlockCardStyle;
  ctaConfig: SlotBlockCtaConfig;
  layout: SlotBlockLayout;
  motion: SlotBlockMotion;
};

export function resolveHomeStructureSlotStyles(
  slotType: PageSection["slotType"],
  sectionStyleJson: string | null | undefined
): HomeStructureSlotResolved | null {
  if (!isHomeStructureSlotType(slotType)) return null;
  const cardStyle = resolveSlotBlockCardStyle(slotType, sectionStyleJson);
  return {
    cardStyle,
    ctaConfig: resolveSlotBlockCtaConfig(slotType, sectionStyleJson),
    layout: resolveSlotBlockLayout(sectionStyleJson, cardStyle),
    motion: resolveSlotBlockMotion(sectionStyleJson),
  };
}

/** 슬롯 블록 `<section>` 배경 — JSON `backgroundColor` + 컬럼 `backgroundColor` 병합 */
export function resolveHomeStructureSlotBackground(section: PageSection): string | undefined {
  if (!isHomeStructureSlotType(section.slotType)) return undefined;
  return resolveSectionStyle(section).backgroundColor;
}

export type HomeStructureSlotFrame = HomeStructureSlotResolved & {
  blockBackgroundColor: string | undefined;
};

export function resolveHomeStructureSlotFrame(section: PageSection): HomeStructureSlotFrame | null {
  const r = resolveHomeStructureSlotStyles(section.slotType, section.sectionStyleJson);
  if (!r) return null;
  return {
    ...r,
    blockBackgroundColor: resolveHomeStructureSlotBackground(section),
  };
}
