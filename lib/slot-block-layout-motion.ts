/**
 * 홈 구조 슬롯 공통: 리스트 레이아웃(grid/carousel) + 모션 옵션.
 * `sectionStyleJson.slotBlockLayout` / `slotBlockMotion` — `slotBlockCard`와 독립.
 */
import { parseSectionStyleJson, type SectionStyleJson } from "@/lib/section-style";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { clampFlowSpeed } from "@/lib/home-carousel-flow";

export type SlotBlockLayoutType = "grid" | "carousel";

export type SlotBlockLayout = {
  type: SlotBlockLayoutType;
  columns: 1 | 2 | 3 | 4;
};

export type SlotBlockMotionSpeed = "slow" | "normal" | "fast";

/** 캐러셀 전환. slide·fade는 UI·저장만 지원(렌더 미구현 시 continuous와 동일). */
export type SlotBlockMotionTransition = "continuous" | "slide" | "fade";

export type SlotBlockMotion = {
  autoPlay: boolean;
  speed: SlotBlockMotionSpeed;
  pauseOnHover: boolean;
  transition: SlotBlockMotionTransition;
};

export const DEFAULT_SLOT_BLOCK_MOTION: SlotBlockMotion = {
  autoPlay: true,
  speed: "normal",
  pauseOnHover: true,
  transition: "continuous",
};

function normalizeLayoutType(v: unknown): SlotBlockLayoutType {
  return v === "grid" ? "grid" : "carousel";
}

function normalizeLayoutColumns(v: unknown): 1 | 2 | 3 | 4 {
  const n = Number(v);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

/**
 * `slotBlockLayout` 없을 때 `slotBlockCard.columns`만으로 보간.
 * - `"carousel"` → 캐러셀
 * - 숫자 2~4 → 그리드(열 수)
 * - 그 외(1 등) → 1열 그리드
 */
function layoutFallbackFromCard(cardStyle: SlotBlockCardStyle): SlotBlockLayout {
  if (cardStyle.columns === "carousel") {
    return { type: "carousel", columns: 1 };
  }
  const c = Number(cardStyle.columns);
  if (c > 1 && c <= 4) {
    return { type: "grid", columns: c as 1 | 2 | 3 | 4 };
  }
  return { type: "grid", columns: 1 };
}

export function partialSlotBlockLayoutFromUnknown(raw: unknown): Partial<SlotBlockLayout> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    type: o.type !== undefined ? normalizeLayoutType(o.type) : undefined,
    columns: o.columns !== undefined ? normalizeLayoutColumns(o.columns) : undefined,
  };
}

export function coerceSlotBlockLayout(raw: unknown, cardStyle: SlotBlockCardStyle): SlotBlockLayout {
  const base = layoutFallbackFromCard(cardStyle);
  const p = partialSlotBlockLayoutFromUnknown(raw);
  let type = p.type ?? base.type;
  const columns = p.columns ?? base.columns;
  if (p.type === undefined && p.columns !== undefined && columns > 1) {
    type = "grid";
  }
  return { type, columns };
}

export function resolveSlotBlockLayout(
  sectionStyleJson: string | null | undefined,
  cardStyle: SlotBlockCardStyle
): SlotBlockLayout {
  const j = parseSectionStyleJson(sectionStyleJson);
  return coerceSlotBlockLayout(j.slotBlockLayout, cardStyle);
}

function normalizeMotionSpeed(v: unknown): SlotBlockMotionSpeed {
  if (v === "slow" || v === "fast") return v;
  return "normal";
}

function normalizeMotionTransition(v: unknown): SlotBlockMotionTransition {
  if (v === "slide" || v === "fade") return v;
  return "continuous";
}

export function partialSlotBlockMotionFromUnknown(raw: unknown): Partial<SlotBlockMotion> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    autoPlay: typeof o.autoPlay === "boolean" ? o.autoPlay : undefined,
    speed: o.speed !== undefined ? normalizeMotionSpeed(o.speed) : undefined,
    pauseOnHover: typeof o.pauseOnHover === "boolean" ? o.pauseOnHover : undefined,
    transition: o.transition !== undefined ? normalizeMotionTransition(o.transition) : undefined,
  };
}

export function coerceSlotBlockMotion(raw: unknown): SlotBlockMotion {
  const p = partialSlotBlockMotionFromUnknown(raw);
  return {
    autoPlay: p.autoPlay ?? DEFAULT_SLOT_BLOCK_MOTION.autoPlay,
    speed: p.speed ?? DEFAULT_SLOT_BLOCK_MOTION.speed,
    pauseOnHover: p.pauseOnHover ?? DEFAULT_SLOT_BLOCK_MOTION.pauseOnHover,
    transition: p.transition ?? DEFAULT_SLOT_BLOCK_MOTION.transition,
  };
}

export function resolveSlotBlockMotion(sectionStyleJson: string | null | undefined): SlotBlockMotion {
  const j = parseSectionStyleJson(sectionStyleJson);
  return coerceSlotBlockMotion(j.slotBlockMotion);
}

/**
 * 사이트 전역 `homeCarouselFlowSpeed`(1~100)에 블록 속도 배율 적용.
 * slow ×0.6 · normal ×1 · fast ×1.5 (반올림 후 clamp)
 */
export function slotMotionEffectiveFlowSpeed(
  siteFlowSpeed: unknown,
  motion: Pick<SlotBlockMotion, "speed">
): number {
  const base = clampFlowSpeed(siteFlowSpeed);
  let mult = 1;
  switch (motion.speed) {
    case "slow":
      mult = 0.6;
      break;
    case "fast":
      mult = 1.5;
      break;
    default:
      mult = 1;
  }
  return clampFlowSpeed(Math.round(base * mult));
}

/** 카드 스타일과 동기화(저장 호환): 레이아웃에 맞게 columns 필드만 덮어씀 */
export function cardStyleWithResolvedLayout(
  cardStyle: SlotBlockCardStyle,
  layout: SlotBlockLayout
): SlotBlockCardStyle {
  const columns = layout.type === "carousel" ? "carousel" : layout.columns;
  return { ...cardStyle, columns };
}

export function mergeSlotBlockFrameIntoSectionStyleJson(
  existingRaw: string | null | undefined,
  patch: {
    slotBlockLayout?: SlotBlockLayout;
    slotBlockMotion?: SlotBlockMotion;
    backgroundColor?: string | null;
  }
): string {
  const parsed = parseSectionStyleJson(existingRaw);
  const next: SectionStyleJson = { ...parsed };
  if (patch.slotBlockLayout !== undefined) {
    next.slotBlockLayout = { ...patch.slotBlockLayout };
  }
  if (patch.slotBlockMotion !== undefined) {
    next.slotBlockMotion = { ...patch.slotBlockMotion };
  }
  if (patch.backgroundColor !== undefined) {
    const t = patch.backgroundColor?.trim() ?? "";
    if (t) next.backgroundColor = t;
    else delete next.backgroundColor;
  }
  return JSON.stringify(next);
}
