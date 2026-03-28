/**
 * PageSection.sectionStyleJson 파싱·병합 (홈 섹션 스타일)
 */
import type { PageSection } from "@/types/page-section";

export type SectionAnimationPreset = "static" | "fade" | "snap" | "flow";

export type SectionDividerStyle = "none" | "solid" | "dashed";

export type SectionDividerConfig = {
  enabled: boolean;
  style: SectionDividerStyle;
  widthPx: number;
  color: string;
};

export type SectionStyleJson = {
  backgroundColor?: string | null;
  animationPreset?: SectionAnimationPreset;
  divider?: Partial<SectionDividerConfig>;
};

const DEFAULT_DIVIDER: SectionDividerConfig = {
  enabled: false,
  style: "solid",
  widthPx: 1,
  color: "#e5e7eb",
};

export function parseSectionStyleJson(raw: string | null | undefined): SectionStyleJson {
  if (!raw || typeof raw !== "string" || !raw.trim()) return {};
  try {
    return JSON.parse(raw) as SectionStyleJson;
  } catch {
    return {};
  }
}

function normalizeAnimationPreset(v: unknown): SectionAnimationPreset {
  if (v === "fade" || v === "snap" || v === "flow" || v === "static") return v;
  return "static";
}

function normalizeDividerStyle(v: unknown): SectionDividerStyle {
  if (v === "none" || v === "solid" || v === "dashed") return v;
  return "solid";
}

/** 관리자/DB에 저장된 값과 컬럼 backgroundColor를 병합 */
export function resolveSectionStyle(section: PageSection): {
  backgroundColor: string | undefined;
  animationPreset: SectionAnimationPreset;
  divider: SectionDividerConfig;
} {
  const j = parseSectionStyleJson(section.sectionStyleJson);
  const fromJson = (j.backgroundColor ?? "").trim();
  const fromCol = (section.backgroundColor ?? "").trim();
  const bg = (fromJson || fromCol) || undefined;
  const animationPreset = normalizeAnimationPreset(j.animationPreset);
  const divIn = j.divider ?? {};
  const divider: SectionDividerConfig = {
    ...DEFAULT_DIVIDER,
    ...divIn,
    style: normalizeDividerStyle(divIn.style),
    widthPx: Math.min(16, Math.max(1, Math.floor(Number(divIn.widthPx) || DEFAULT_DIVIDER.widthPx))),
    color: (divIn.color ?? DEFAULT_DIVIDER.color).trim() || DEFAULT_DIVIDER.color,
  };
  return { backgroundColor: bg, animationPreset, divider };
}

export function sectionAnimationClass(preset: SectionAnimationPreset): string {
  switch (preset) {
    case "fade":
      return "section-anim-fade";
    case "snap":
      return "section-anim-snap";
    case "flow":
      return "section-anim-flow";
    default:
      return "";
  }
}

/** 폼 → DB JSON (기본값이면 null) */
export function serializeSectionStyleJson(opts: {
  animationPreset: SectionAnimationPreset;
  divider: SectionDividerConfig;
}): string | null {
  const animDefault = opts.animationPreset === "static";
  const d = opts.divider;
  const divDefault =
    !d.enabled &&
    d.style === "solid" &&
    d.widthPx === 1 &&
    d.color === DEFAULT_DIVIDER.color;
  if (animDefault && divDefault) return null;
  const obj: SectionStyleJson = {};
  if (!animDefault) obj.animationPreset = opts.animationPreset;
  if (!divDefault) obj.divider = { ...d };
  return JSON.stringify(obj);
}
