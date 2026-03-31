/**
 * 홈 구조 슬롯(PageSlotBlock) 블록 단위 카드 스타일 — sectionStyleJson.slotBlockCard
 * CSS 문자열 입력 없음, 옵션 → Tailwind 클래스만.
 */
import type { PageSectionSlotType } from "@/types/page-section";
import { parseSectionStyleJson, type SectionStyleJson } from "@/lib/section-style";
import {
  normalizeHomeStructureSlotType,
  type HomeStructureSlotType,
} from "@/lib/home-structure-slots";
import { cn } from "@/lib/utils";

export type SlotBlockCardSurface = "flat" | "border" | "shadow" | "elevated";

export type SlotBlockCardSize = "small" | "medium" | "large";

export type SlotBlockCardColumns = 1 | 2 | 3 | 4 | "carousel";

export type SlotBlockCardHover = "none" | "lift" | "shadow" | "scale";

export type SlotBlockCardBorderRadius = "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";

export type SlotBlockCardGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";

export type SlotBlockCardThumbnailRatio = "16:9" | "4:3" | "1:1" | "3:4" | "5:2";

/** 0 = 제한 없음 */
export type SlotBlockCardTextClamp = 0 | 1 | 2 | 3 | 4;

export type SlotBlockCardStyle = {
  cardStyle: SlotBlockCardSurface;
  cardSize: SlotBlockCardSize;
  columns: SlotBlockCardColumns;
  hoverEffect: SlotBlockCardHover;
  borderRadius: SlotBlockCardBorderRadius;
  cardGap: SlotBlockCardGap;
  thumbnailRatio: SlotBlockCardThumbnailRatio;
  textLineClamp: SlotBlockCardTextClamp;
};

const DEFAULTS: Record<HomeStructureSlotType, SlotBlockCardStyle> = {
  /** HomeTournamentCardItem: border + shadow-sm, 캐러셀, rounded-2xl, gap-4, aspect 5/2, 제목 line-clamp-2 */
  tournamentIntro: {
    cardStyle: "border",
    cardSize: "medium",
    columns: "carousel",
    hoverEffect: "shadow",
    borderRadius: "2xl",
    cardGap: "md",
    thumbnailRatio: "5:2",
    textLineClamp: 2,
  },
  /** VenueCarousel: 가로 스크롤, rounded-xl 카드, 원형 썸네일, hover scale */
  venueIntro: {
    cardStyle: "border",
    cardSize: "medium",
    columns: "carousel",
    hoverEffect: "scale",
    borderRadius: "xl",
    cardGap: "md",
    thumbnailRatio: "1:1",
    textLineClamp: 2,
  },
  /** 단일 링크 줄 — 얇은 카드 느낌 */
  venueLink: {
    cardStyle: "border",
    cardSize: "small",
    columns: 1,
    hoverEffect: "shadow",
    borderRadius: "xl",
    cardGap: "sm",
    thumbnailRatio: "1:1",
    textLineClamp: 2,
  },
  /** 두 개의 큰 진입 카드 — rounded-2xl, shadow-sm, 세로 스택 */
  nanguEntry: {
    cardStyle: "border",
    cardSize: "medium",
    columns: 1,
    hoverEffect: "shadow",
    borderRadius: "2xl",
    cardGap: "md",
    thumbnailRatio: "1:1",
    textLineClamp: 3,
  },
};

function normalizeSurface(v: unknown): SlotBlockCardSurface {
  if (v === "flat" || v === "border" || v === "shadow" || v === "elevated") return v;
  return "border";
}

function normalizeSize(v: unknown): SlotBlockCardSize {
  if (v === "small" || v === "medium" || v === "large") return v;
  return "medium";
}

function normalizeColumns(v: unknown): SlotBlockCardColumns {
  if (v === "carousel") return "carousel";
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return "carousel";
}

function normalizeHover(v: unknown): SlotBlockCardHover {
  if (v === "none" || v === "lift" || v === "shadow" || v === "scale") return v;
  return "shadow";
}

function normalizeRadius(v: unknown): SlotBlockCardBorderRadius {
  if (v === "none" || v === "sm" || v === "md" || v === "lg" || v === "xl" || v === "2xl" || v === "full") return v;
  return "2xl";
}

function normalizeGap(v: unknown): SlotBlockCardGap {
  if (v === "none" || v === "xs" || v === "sm" || v === "md" || v === "lg" || v === "xl") return v;
  return "md";
}

function normalizeRatio(v: unknown): SlotBlockCardThumbnailRatio {
  if (v === "16:9" || v === "4:3" || v === "1:1" || v === "3:4" || v === "5:2") return v;
  return "5:2";
}

function normalizeClamp(v: unknown): SlotBlockCardTextClamp {
  const n = Number(v);
  if (n === 0 || n === 1 || n === 2 || n === 3 || n === 4) return n as SlotBlockCardTextClamp;
  return 2;
}

export function partialSlotBlockCardFromUnknown(raw: unknown): Partial<SlotBlockCardStyle> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    cardStyle: o.cardStyle !== undefined ? normalizeSurface(o.cardStyle) : undefined,
    cardSize: o.cardSize !== undefined ? normalizeSize(o.cardSize) : undefined,
    columns: o.columns !== undefined ? normalizeColumns(o.columns) : undefined,
    hoverEffect: o.hoverEffect !== undefined ? normalizeHover(o.hoverEffect) : undefined,
    borderRadius: o.borderRadius !== undefined ? normalizeRadius(o.borderRadius) : undefined,
    cardGap: o.cardGap !== undefined ? normalizeGap(o.cardGap) : undefined,
    thumbnailRatio: o.thumbnailRatio !== undefined ? normalizeRatio(o.thumbnailRatio) : undefined,
    textLineClamp: o.textLineClamp !== undefined ? normalizeClamp(o.textLineClamp) : undefined,
  };
}

export function getDefaultSlotBlockCardStyle(slotType: PageSectionSlotType | null | undefined): SlotBlockCardStyle {
  const n = normalizeHomeStructureSlotType(slotType);
  if (n) return { ...DEFAULTS[n] };
  return { ...DEFAULTS.tournamentIntro };
}

export function parseSlotBlockCardFromSectionJson(json: SectionStyleJson): Partial<SlotBlockCardStyle> {
  return partialSlotBlockCardFromUnknown(json.slotBlockCard);
}

export function coerceSlotBlockCardStyle(
  slotType: PageSectionSlotType | null | undefined,
  raw: unknown
): SlotBlockCardStyle {
  const base = getDefaultSlotBlockCardStyle(slotType);
  if (!raw || typeof raw !== "object") return base;
  return { ...base, ...partialSlotBlockCardFromUnknown(raw) };
}

export function resolveSlotBlockCardStyle(
  slotType: PageSectionSlotType | null | undefined,
  sectionStyleJson: string | null | undefined
): SlotBlockCardStyle {
  const base = getDefaultSlotBlockCardStyle(slotType);
  const parsed = parseSectionStyleJson(sectionStyleJson);
  const partial = parseSlotBlockCardFromSectionJson(parsed);
  return { ...base, ...partial };
}

export function mergeSlotBlockCardIntoSectionStyleJson(
  existingRaw: string | null | undefined,
  card: SlotBlockCardStyle
): string {
  const parsed = parseSectionStyleJson(existingRaw);
  const next: SectionStyleJson = {
    ...parsed,
    slotBlockCard: { ...card } as unknown as Record<string, unknown>,
  };
  return JSON.stringify(next);
}

function radiusClass(r: SlotBlockCardBorderRadius): string {
  switch (r) {
    case "none":
      return "rounded-none";
    case "sm":
      return "rounded-sm";
    case "md":
      return "rounded-md";
    case "lg":
      return "rounded-lg";
    case "xl":
      return "rounded-xl";
    case "2xl":
      return "rounded-2xl";
    case "full":
      return "rounded-full";
    default:
      return "rounded-2xl";
  }
}

/** 카드 면(플랫·테두리·그림자) — 렌더·관리자 미리보기 버튼 공용 */
export function slotBlockCardSurfaceClasses(surface: SlotBlockCardSurface): string {
  switch (surface) {
    case "flat":
      return "border border-transparent bg-site-card shadow-none";
    case "border":
      return "border border-site-border bg-site-card shadow-sm";
    case "shadow":
      return "border-0 bg-site-card shadow-md";
    case "elevated":
      return "border border-site-border bg-site-card shadow-lg";
    default:
      return "border border-site-border bg-site-card shadow-sm";
  }
}

export function hoverClasses(h: SlotBlockCardHover): string {
  switch (h) {
    case "none":
      return "transition-none";
    case "lift":
      return "transition duration-200 hover:-translate-y-1 hover:border-site-primary/30";
    case "shadow":
      return "transition duration-200 hover:border-site-primary/30 hover:shadow-md";
    case "scale":
      return "transition duration-200 hover:border-site-primary/30 hover:scale-[1.02] active:scale-[0.99]";
    default:
      return "";
  }
}

export function gapClass(g: SlotBlockCardGap): string {
  switch (g) {
    case "none":
      return "gap-0";
    case "xs":
      return "gap-1";
    case "sm":
      return "gap-2";
    case "md":
      return "gap-4";
    case "lg":
      return "gap-6";
    case "xl":
      return "gap-8";
    default:
      return "gap-4";
  }
}

function thumbnailAspectClass(r: SlotBlockCardThumbnailRatio): string {
  switch (r) {
    case "16:9":
      return "aspect-video";
    case "4:3":
      return "aspect-[4/3]";
    case "1:1":
      return "aspect-square";
    case "3:4":
      return "aspect-[3/4]";
    case "5:2":
      return "aspect-[5/2]";
    default:
      return "aspect-[5/2]";
  }
}

function titleClampClass(n: SlotBlockCardTextClamp): string {
  if (n === 0) return "";
  if (n === 1) return "line-clamp-1";
  if (n === 2) return "line-clamp-2";
  if (n === 3) return "line-clamp-3";
  return "line-clamp-4";
}

export function slotBlockLineClampClass(style: SlotBlockCardStyle): string {
  return titleClampClass(style.textLineClamp) || "line-clamp-none";
}

function bodyPaddingClass(size: SlotBlockCardSize): string {
  switch (size) {
    case "small":
      return "p-2 gap-1";
    case "large":
      return "p-4 gap-3";
    default:
      return "p-3 gap-2";
  }
}

function titleTextClass(size: SlotBlockCardSize): string {
  switch (size) {
    case "small":
      return "text-xs md:text-sm";
    case "large":
      return "text-base md:text-lg";
    default:
      return "text-sm md:text-base";
  }
}

/** 대회 카드 링크(썸네일 제외 본문) */
export function tournamentCardLinkClasses(style: SlotBlockCardStyle): string {
  return cn(
    "group flex h-full min-h-[200px] flex-col overflow-hidden transition sm:min-h-0",
    radiusClass(style.borderRadius),
    slotBlockCardSurfaceClasses(style.cardStyle),
    hoverClasses(style.hoverEffect)
  );
}

export function tournamentPosterShellClasses(style: SlotBlockCardStyle): string {
  return cn(
    "relative w-full min-h-[7rem] shrink-0 overflow-hidden bg-gray-100 md:min-h-[10rem]",
    thumbnailAspectClass(style.thumbnailRatio)
  );
}

export function tournamentCardBodyClasses(style: SlotBlockCardStyle): string {
  return cn("flex flex-1 flex-col min-h-[7.5rem]", bodyPaddingClass(style.cardSize));
}

export function tournamentTitleClasses(style: SlotBlockCardStyle): string {
  return cn(
    "font-semibold text-site-text group-hover:text-site-primary min-h-[2.5rem]",
    titleTextClass(style.cardSize),
    titleClampClass(style.textLineClamp)
  );
}

export function tournamentListRowGapClass(style: SlotBlockCardStyle): string {
  return gapClass(style.cardGap);
}

export function tournamentCarouselLiClasses(style: SlotBlockCardStyle): string {
  return "flex h-full min-h-[200px] w-[260px] min-w-[260px] shrink-0 sm:min-h-0 sm:w-[280px] sm:min-w-[280px]";
}

export function tournamentGridLiClasses(): string {
  return "flex h-full min-h-0 min-w-0 w-full";
}

export function tournamentGridUlClass(columns: 1 | 2 | 3 | 4, style: SlotBlockCardStyle): string {
  const col =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-1 sm:grid-cols-2"
        : columns === 3
          ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
          : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
  return cn("grid w-full", col, gapClass(style.cardGap));
}

export function venueLinkShellClasses(style: SlotBlockCardStyle): string {
  return cn(
    "inline-flex flex-wrap items-center justify-center",
    radiusClass(style.borderRadius),
    slotBlockCardSurfaceClasses(style.cardStyle),
    hoverClasses(style.hoverEffect),
    style.cardSize === "small" ? "px-4 py-2" : style.cardSize === "large" ? "px-8 py-4" : "px-5 py-3"
  );
}

export function nanguEntryGridClass(style: SlotBlockCardStyle): string {
  const cols = style.columns === "carousel" ? 1 : style.columns;
  return cn("mx-auto w-full max-w-xl", tournamentGridUlClass(cols === 1 ? 1 : cols === 2 ? 2 : cols === 3 ? 3 : 4, style));
}

export function cardShadowTierClass(style: SlotBlockCardStyle): string {
  switch (style.cardStyle) {
    case "flat":
      return "shadow-none";
    case "shadow":
      return "shadow-md";
    case "elevated":
      return "shadow-lg";
    default:
      return "shadow-sm";
  }
}

/** 그라데이션·테마 보더는 유지하고 블록 스타일 옵션을 합성 */
export function nanguEntryCardComposeClasses(style: SlotBlockCardStyle, theme: "emerald" | "sky"): string {
  const border =
    theme === "emerald"
      ? "border border-emerald-300 dark:border-emerald-700"
      : "border border-sky-300 dark:border-sky-600";
  const bg =
    theme === "emerald"
      ? "bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950 dark:to-emerald-900/90"
      : "bg-gradient-to-br from-sky-100 to-sky-50 dark:from-sky-950 dark:to-sky-900/90";
  const pad =
    style.cardSize === "small" ? "gap-3 p-4" : style.cardSize === "large" ? "gap-5 p-7" : "gap-4 p-5";
  return cn(
    "flex items-center transition",
    border,
    bg,
    radiusClass(style.borderRadius),
    hoverClasses(style.hoverEffect),
    cardShadowTierClass(style),
    pad
  );
}

export function nanguEntryDescClampClass(style: SlotBlockCardStyle): string {
  return titleClampClass(style.textLineClamp) || "line-clamp-none";
}

/** venue 그리드 카드 (캐러셀 비모드) */
export function venueGridCardLinkClasses(style: SlotBlockCardStyle): string {
  return cn(
    "flex flex-col items-center min-w-0 w-full group py-3 px-2 min-h-[120px] transition",
    radiusClass(style.borderRadius),
    slotBlockCardSurfaceClasses(style.cardStyle),
    hoverClasses(style.hoverEffect)
  );
}

export function venueThumbShellClasses(style: SlotBlockCardStyle, circular: boolean): string {
  if (circular) {
    const dim =
      style.cardSize === "small"
        ? "w-16 h-16 sm:w-[72px] sm:h-[72px]"
        : style.cardSize === "large"
          ? "w-[104px] h-[104px] sm:w-[112px] sm:h-[112px]"
          : "w-[88px] h-[88px] sm:w-[96px] sm:h-[96px]";
    return cn(
      "relative overflow-hidden bg-site-bg border border-site-border flex-shrink-0 rounded-full transition-transform duration-200",
      dim,
      style.hoverEffect === "scale" && "group-hover:scale-105"
    );
  }
  return cn(
    "relative w-full overflow-hidden bg-site-bg border border-site-border flex-shrink-0 transition-transform duration-200",
    thumbnailAspectClass(style.thumbnailRatio),
    radiusClass(style.borderRadius)
  );
}

export function slotBlockStyleSupported(slotType: PageSectionSlotType | null | undefined): boolean {
  return normalizeHomeStructureSlotType(slotType) != null;
}

/** 캐러셀 행 링크에 덧씌울 모서리·그림자(기존 폭 계산 클래스는 유지) */
export function venueCarouselLinkExtraClasses(style: SlotBlockCardStyle): string {
  return cn(radiusClass(style.borderRadius), cardShadowTierClass(style));
}
