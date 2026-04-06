export type PlatformCardTemplateType = "basic" | "highlight";
export type PlatformCardRatioPreset = "1:1" | "2:3" | "3:5" | "1:2";
export type PlatformCardTextPosition = "top" | "center" | "bottom";
export type PlatformCardDescriptionPosition = "title-below" | "center" | "bottom";
export type PlatformCardTextAlign = "left" | "center" | "right";
export type PlatformCardStatusPosition =
  | "top-left"
  | "top-right"
  | "title-above"
  | "title-below"
  | "bottom-right";

export type PlatformCardTemplateFieldKey =
  | "image"
  | "title"
  | "dateRegion"
  | "statusBadge"
  | "shortDescription";

export type PlatformCardTemplatePolicy = {
  templateType: PlatformCardTemplateType;
  label: string;
  description: string;
  fields: PlatformCardTemplateFieldKey[];
  supportsWholeCardClick: boolean;
  showDetailButton: boolean;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
};

export type PlatformCardTemplateStylePolicy = {
  cardWidth: number;
  cardHeight: number;
  outerMargin: number;
  imageAreaHeight: number;
  textAreaPadding: number;
  ratioPreset: PlatformCardRatioPreset;
  titlePosition: PlatformCardTextPosition;
  titleAlign: PlatformCardTextAlign;
  shortDescriptionPosition: PlatformCardDescriptionPosition;
  shortDescriptionAlign: PlatformCardTextAlign;
  statusPosition: PlatformCardStatusPosition;
  statusAlign: PlatformCardTextAlign;
  titleFontSize: number;
  shortDescriptionFontSize: number;
  statusFontSize: number;
  textColor: string;
  backgroundColor: string;
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  titleContentGap: number;
  gapBetweenElements: number;
};

export const PLATFORM_CARD_TEMPLATE_POLICIES: PlatformCardTemplatePolicy[] = [
  {
    templateType: "basic",
    label: "기본형",
    description: "이미지, 상태 뱃지, 대회명, 날짜/지역, 카드 전체 클릭",
    fields: ["image", "statusBadge", "title", "dateRegion"],
    supportsWholeCardClick: true,
    showDetailButton: false,
    isActive: true,
    isDefault: true,
    sortOrder: 1,
  },
  {
    templateType: "highlight",
    label: "강조형",
    description: "큰 이미지, 상태/강조 뱃지, 대회명, 짧은 설명, 카드 전체 클릭",
    fields: ["image", "statusBadge", "title", "shortDescription"],
    supportsWholeCardClick: true,
    showDetailButton: true,
    isActive: true,
    isDefault: false,
    sortOrder: 2,
  },
];

export const PLATFORM_CARD_TEMPLATE_FIELD_LABELS: Record<PlatformCardTemplateFieldKey, string> = {
  image: "이미지",
  title: "제목",
  dateRegion: "날짜/지역",
  statusBadge: "상태",
  shortDescription: "짧은 설명",
};

export const PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS: Record<PlatformCardTemplateType, string> = {
  basic: "platform.cardTemplate.basic.style",
  highlight: "platform.cardTemplate.highlight.style",
};
export const PLATFORM_CARD_TEMPLATE_ACTIVE_COPY_KEYS: Record<PlatformCardTemplateType, string> = {
  basic: "platform.cardTemplate.basic.isActive",
  highlight: "platform.cardTemplate.highlight.isActive",
};
export const PLATFORM_CARD_TEMPLATE_DEFAULT_COPY_KEYS: Record<PlatformCardTemplateType, string> = {
  basic: "platform.cardTemplate.basic.isDefault",
  highlight: "platform.cardTemplate.highlight.isDefault",
};
export const PLATFORM_CARD_TEMPLATE_DETAIL_BUTTON_COPY_KEYS: Record<PlatformCardTemplateType, string> = {
  basic: "platform.cardTemplate.basic.showDetailButton",
  highlight: "platform.cardTemplate.highlight.showDetailButton",
};

const DEFAULT_STYLE: PlatformCardTemplateStylePolicy = {
  cardWidth: 320,
  cardHeight: 320,
  outerMargin: 0,
  imageAreaHeight: 180,
  textAreaPadding: 12,
  ratioPreset: "3:5",
  titlePosition: "top",
  titleAlign: "left",
  shortDescriptionPosition: "title-below",
  shortDescriptionAlign: "left",
  statusPosition: "top-right",
  statusAlign: "right",
  titleFontSize: 16,
  shortDescriptionFontSize: 12,
  statusFontSize: 12,
  textColor: "#111827",
  backgroundColor: "#ffffff",
  paddingTop: 12,
  paddingBottom: 12,
  paddingLeft: 12,
  paddingRight: 12,
  titleContentGap: 6,
  gapBetweenElements: 8,
};

export const DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES: Record<
  PlatformCardTemplateType,
  PlatformCardTemplateStylePolicy
> = {
  basic: {
    ...DEFAULT_STYLE,
    cardHeight: 300,
    imageAreaHeight: 170,
    ratioPreset: "3:5",
    shortDescriptionPosition: "bottom",
  },
  highlight: {
    ...DEFAULT_STYLE,
    cardHeight: 340,
    imageAreaHeight: 200,
    ratioPreset: "3:5",
    statusPosition: "top-left",
  },
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeRatioPreset(value: unknown): PlatformCardRatioPreset {
  if (value === "1:1" || value === "2:3" || value === "3:5" || value === "1:2") return value;
  return "3:5";
}

function normalizeTextPosition(value: unknown): PlatformCardTextPosition {
  if (value === "top" || value === "center" || value === "bottom") return value;
  return "top";
}

function normalizeDescriptionPosition(value: unknown): PlatformCardDescriptionPosition {
  if (value === "title-below" || value === "center" || value === "bottom") return value;
  return "title-below";
}

function normalizeTextAlign(value: unknown): PlatformCardTextAlign {
  if (value === "left" || value === "center" || value === "right") return value;
  return "left";
}

function normalizeStatusPosition(value: unknown): PlatformCardStatusPosition {
  if (
    value === "top-left" ||
    value === "top-right" ||
    value === "title-above" ||
    value === "title-below" ||
    value === "bottom-right"
  ) {
    return value;
  }
  return "top-right";
}

export function resolvePlatformCardTemplateStylePolicy(
  raw: string | null | undefined,
  templateType: PlatformCardTemplateType
): PlatformCardTemplateStylePolicy {
  const fallback = DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES[templateType];
  if (!raw?.trim()) return { ...fallback };
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    return {
      cardWidth: clampInt(p.cardWidth, 180, 800, fallback.cardWidth),
      cardHeight: clampInt(p.cardHeight, 180, 1000, fallback.cardHeight),
      outerMargin: clampInt(p.outerMargin, 0, 80, fallback.outerMargin),
      imageAreaHeight: clampInt(p.imageAreaHeight, 60, 700, fallback.imageAreaHeight),
      textAreaPadding: clampInt(p.textAreaPadding, 0, 80, fallback.textAreaPadding),
      ratioPreset: normalizeRatioPreset(p.ratioPreset ?? fallback.ratioPreset),
      titlePosition: normalizeTextPosition(p.titlePosition ?? fallback.titlePosition),
      titleAlign: normalizeTextAlign(p.titleAlign ?? fallback.titleAlign),
      shortDescriptionPosition: normalizeDescriptionPosition(
        p.shortDescriptionPosition ?? fallback.shortDescriptionPosition
      ),
      shortDescriptionAlign: normalizeTextAlign(
        p.shortDescriptionAlign ?? fallback.shortDescriptionAlign
      ),
      statusPosition: normalizeStatusPosition(p.statusPosition ?? fallback.statusPosition),
      statusAlign: normalizeTextAlign(p.statusAlign ?? fallback.statusAlign),
      titleFontSize: clampInt(p.titleFontSize, 10, 48, fallback.titleFontSize),
      shortDescriptionFontSize: clampInt(
        p.shortDescriptionFontSize,
        10,
        40,
        fallback.shortDescriptionFontSize
      ),
      statusFontSize: clampInt(p.statusFontSize, 10, 28, fallback.statusFontSize),
      textColor: typeof p.textColor === "string" && p.textColor.trim() ? p.textColor : fallback.textColor,
      backgroundColor:
        typeof p.backgroundColor === "string" && p.backgroundColor.trim()
          ? p.backgroundColor
          : fallback.backgroundColor,
      paddingTop: clampInt(p.paddingTop, 0, 120, fallback.paddingTop),
      paddingBottom: clampInt(p.paddingBottom, 0, 120, fallback.paddingBottom),
      paddingLeft: clampInt(p.paddingLeft, 0, 120, fallback.paddingLeft),
      paddingRight: clampInt(p.paddingRight, 0, 120, fallback.paddingRight),
      titleContentGap: clampInt(p.titleContentGap, 0, 48, fallback.titleContentGap),
      gapBetweenElements: clampInt(p.gapBetweenElements, 0, 48, fallback.gapBetweenElements),
    };
  } catch {
    return { ...fallback };
  }
}

export function toPlatformCardTemplateStyleRaw(value: PlatformCardTemplateStylePolicy): string {
  return JSON.stringify(value);
}

function toBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
    if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  }
  return fallback;
}

export function resolvePlatformCardTemplatePolicies(
  copy?: Record<string, string> | null
): PlatformCardTemplatePolicy[] {
  const list = PLATFORM_CARD_TEMPLATE_POLICIES.map((item) => ({
    ...item,
    isActive: toBool(copy?.[PLATFORM_CARD_TEMPLATE_ACTIVE_COPY_KEYS[item.templateType]], item.isActive),
    isDefault: toBool(copy?.[PLATFORM_CARD_TEMPLATE_DEFAULT_COPY_KEYS[item.templateType]], item.isDefault),
    showDetailButton: toBool(
      copy?.[PLATFORM_CARD_TEMPLATE_DETAIL_BUTTON_COPY_KEYS[item.templateType]],
      item.showDetailButton
    ),
  }));

  const active = list.filter((item) => item.isActive);
  const activeWithDefault = active.filter((item) => item.isDefault);
  if (active.length === 0) {
    return list.map((item, index) => ({
      ...item,
      isActive: item.templateType === "basic",
      isDefault: item.templateType === "basic" || index === 0,
    }));
  }
  if (activeWithDefault.length === 1) return list;

  const defaultType =
    activeWithDefault[0]?.templateType ?? active.find((item) => item.templateType === "basic")?.templateType ?? active[0].templateType;
  return list.map((item) => ({
    ...item,
    isDefault: item.isActive && item.templateType === defaultType,
  }));
}
