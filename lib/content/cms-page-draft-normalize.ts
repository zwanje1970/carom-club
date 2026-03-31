/**
 * 초안 JSON ↔ PageSection 정규화 (게시 검증·저장 시 기본값 보장).
 * 공개 조회 경로에서는 사용하지 않는다.
 */

import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import type {
  InternalPageSlug,
  LinkType,
  PageSection,
  PageSlug,
  PlacementSlug,
  SectionButton,
  SectionType,
  TextAlign,
} from "@/types/page-section";

export const CMS_DRAFT_SCHEMA_VERSION = 1 as const;

const SECTION_TYPES = new Set<string>(["image", "text", "cta"]);
const PLACEMENTS = new Set<string>([
  "below_header",
  "main_visual_bg",
  "below_main_copy",
  "above_content",
  "content_middle",
  "content_bottom",
]);
const TEXT_ALIGNS = new Set<string>(["left", "center", "right"]);
const LINK_TYPES = new Set<string>(["none", "internal", "external"]);
const INTERNAL_PAGES = new Set<string>([
  "home",
  "venues",
  "tournaments",
  "community",
  "mypage",
  "login",
  "signup",
]);

const SLOT_TYPES = new Set<string>([
  "hero",
  "noticeOverlay",
  "cmsPageSections",
  "quickMenu",
  "homeCarousels",
  "tournamentIntro",
  "venueIntro",
  "venueLink",
  "nanguEntry",
  "postList",
  "nanguList",
  "tournamentList",
]);

const isoNow = () => new Date().toISOString();

function coerceString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function coerceNullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v;
  return String(v);
}

function coerceBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  return fallback;
}

function coerceInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return fallback;
}

function coerceNullableInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function normalizeButton(raw: unknown, index: number): SectionButton {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id =
    typeof o.id === "string" && o.id.trim()
      ? o.id.trim()
      : `btn-${index}-${Math.random().toString(36).slice(2, 9)}`;
  const linkType =
    o.linkType === "internal" || o.linkType === "external" ? o.linkType : "external";
  return {
    id,
    name: coerceString(o.name, ""),
    linkType,
    href: coerceString(o.href, ""),
    openInNewTab: coerceBool(o.openInNewTab, false),
    isPrimary: coerceBool(o.isPrimary, false),
    size: o.size === "sm" || o.size === "md" || o.size === "lg" ? o.size : undefined,
  };
}

/** 서비스 레이어에서 넘어온 PageSection — page 강제·누락 필드 기본값 (항상 완전한 PageSection) */
export function normalizeTrustedSectionForDraft(page: PageBuilderKey, s: PageSection): PageSection {
  const buttons = Array.isArray(s.buttons) ? s.buttons.map((b, i) => normalizeButton(b, i)) : [];
  const type: SectionType = SECTION_TYPES.has(s.type) ? s.type : "text";
  const placement: PlacementSlug = PLACEMENTS.has(s.placement) ? s.placement : "content_middle";
  const textAlign: TextAlign = TEXT_ALIGNS.has(s.textAlign) ? s.textAlign : "center";
  const linkType: LinkType = LINK_TYPES.has(s.linkType) ? s.linkType : "none";
  let internalPage: InternalPageSlug | null = s.internalPage ?? null;
  if (internalPage && !INTERNAL_PAGES.has(internalPage)) internalPage = null;

  let slotType: PageSection["slotType"] = s.slotType ?? null;
  if (slotType && !SLOT_TYPES.has(slotType)) slotType = null;

  return {
    id: s.id,
    type,
    title: typeof s.title === "string" ? s.title : "",
    subtitle: s.subtitle ?? null,
    description: s.description ?? null,
    textAlign,
    page,
    placement,
    imageUrl: s.imageUrl ?? null,
    imageUrlMobile: s.imageUrlMobile ?? null,
    imageHeightPc: s.imageHeightPc ?? null,
    imageHeightMobile: s.imageHeightMobile ?? null,
    linkType,
    internalPage,
    internalPath: s.internalPath ?? null,
    externalUrl: s.externalUrl ?? null,
    openInNewTab: Boolean(s.openInNewTab),
    buttons,
    isVisible: s.isVisible !== false,
    sortOrder: coerceInt(s.sortOrder, 0),
    slotType,
    slotConfigJson: s.slotConfigJson ?? null,
    startAt: s.startAt ?? null,
    endAt: s.endAt ?? null,
    backgroundColor: s.backgroundColor ?? null,
    sectionStyleJson: s.sectionStyleJson ?? null,
    titleIconType: s.titleIconType ?? "none",
    titleIconName: s.titleIconName ?? null,
    titleIconImageUrl: s.titleIconImageUrl ?? null,
    titleIconSize: s.titleIconSize ?? null,
    createdAt: typeof s.createdAt === "string" ? s.createdAt : isoNow(),
    updatedAt: typeof s.updatedAt === "string" ? s.updatedAt : isoNow(),
    deletedAt: s.deletedAt ?? null,
  };
}

export class CmsDraftPublishValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CmsDraftPublishValidationError";
    this.code = code;
  }
}

/** DB JSON 원소 → PageSection (게시 전 검증용). 실패 시 CmsDraftPublishValidationError */
export function coercePageSectionFromDraftJson(
  expectedPage: PageBuilderKey,
  raw: unknown,
  index: number
): PageSection {
  if (!raw || typeof raw !== "object") {
    throw new CmsDraftPublishValidationError("INVALID_SECTION", `섹션 ${index + 1}: 객체가 아닙니다.`);
  }
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : "";
  if (!id) {
    throw new CmsDraftPublishValidationError("MISSING_ID", `섹션 ${index + 1}: id가 없습니다.`);
  }

  const typeStr = typeof o.type === "string" ? o.type : "";
  if (!SECTION_TYPES.has(typeStr)) {
    throw new CmsDraftPublishValidationError(
      "INVALID_TYPE",
      `섹션 ${index + 1} (${id}): type은 image, text, cta 중 하나여야 합니다.`
    );
  }

  const placementStr = typeof o.placement === "string" ? o.placement : "";
  if (!PLACEMENTS.has(placementStr)) {
    throw new CmsDraftPublishValidationError(
      "INVALID_PLACEMENT",
      `섹션 ${index + 1} (${id}): placement가 유효하지 않습니다.`
    );
  }

  const pageInJson = typeof o.page === "string" ? o.page : "";
  if (pageInJson && pageInJson !== expectedPage) {
    throw new CmsDraftPublishValidationError(
      "PAGE_MISMATCH",
      `섹션 ${index + 1} (${id}): page가 ${expectedPage}와 일치해야 합니다.`
    );
  }

  const textAlignStr = typeof o.textAlign === "string" ? o.textAlign : "center";
  if (!TEXT_ALIGNS.has(textAlignStr)) {
    throw new CmsDraftPublishValidationError(
      "INVALID_TEXT_ALIGN",
      `섹션 ${index + 1} (${id}): textAlign이 유효하지 않습니다.`
    );
  }

  const linkTypeStr = typeof o.linkType === "string" ? o.linkType : "none";
  if (!LINK_TYPES.has(linkTypeStr)) {
    throw new CmsDraftPublishValidationError(
      "INVALID_LINK_TYPE",
      `섹션 ${index + 1} (${id}): linkType이 유효하지 않습니다.`
    );
  }

  let internalPage: InternalPageSlug | null = null;
  if (o.internalPage != null && typeof o.internalPage === "string") {
    if (!INTERNAL_PAGES.has(o.internalPage)) {
      throw new CmsDraftPublishValidationError(
        "INVALID_INTERNAL_PAGE",
        `섹션 ${index + 1} (${id}): internalPage가 유효하지 않습니다.`
      );
    }
    internalPage = o.internalPage as InternalPageSlug;
  }

  const buttonsRaw = o.buttons;
  const buttons: SectionButton[] = Array.isArray(buttonsRaw)
    ? buttonsRaw.map((b, bi) => normalizeButton(b, bi))
    : [];

  const sortOrder = coerceInt(o.sortOrder, NaN);
  if (!Number.isFinite(sortOrder)) {
    throw new CmsDraftPublishValidationError(
      "INVALID_SORT_ORDER",
      `섹션 ${index + 1} (${id}): sortOrder가 숫자가 아닙니다.`
    );
  }

  return {
    id,
    type: typeStr as SectionType,
    title: coerceString(o.title, ""),
    subtitle: coerceNullableString(o.subtitle),
    description: coerceNullableString(o.description),
    textAlign: textAlignStr as TextAlign,
    page: expectedPage as PageSlug,
    placement: placementStr as PlacementSlug,
    imageUrl: coerceNullableString(o.imageUrl),
    imageUrlMobile: coerceNullableString(o.imageUrlMobile),
    imageHeightPc: coerceNullableInt(o.imageHeightPc),
    imageHeightMobile: coerceNullableInt(o.imageHeightMobile),
    linkType: linkTypeStr as LinkType,
    internalPage,
    internalPath: coerceNullableString(o.internalPath),
    externalUrl: coerceNullableString(o.externalUrl),
    openInNewTab: coerceBool(o.openInNewTab, false),
    buttons,
    isVisible: coerceBool(o.isVisible, true),
    sortOrder,
    slotType: (() => {
      if (o.slotType === null || o.slotType === undefined || o.slotType === "") return null;
      if (typeof o.slotType !== "string" || !SLOT_TYPES.has(o.slotType)) {
        throw new CmsDraftPublishValidationError(
          "INVALID_SLOT_TYPE",
          `섹션 ${index + 1} (${id}): slotType이 유효하지 않습니다.`
        );
      }
      return o.slotType as NonNullable<PageSection["slotType"]>;
    })(),
    slotConfigJson:
      o.slotConfigJson === null || o.slotConfigJson === undefined
        ? null
        : typeof o.slotConfigJson === "string"
          ? o.slotConfigJson
          : JSON.stringify(o.slotConfigJson),
    startAt: coerceNullableString(o.startAt) as string | null,
    endAt: coerceNullableString(o.endAt) as string | null,
    backgroundColor: coerceNullableString(o.backgroundColor),
    sectionStyleJson:
      o.sectionStyleJson === null || o.sectionStyleJson === undefined
        ? null
        : typeof o.sectionStyleJson === "string"
          ? o.sectionStyleJson
          : JSON.stringify(o.sectionStyleJson),
    titleIconType:
      o.titleIconType === "none" || o.titleIconType === "icon" || o.titleIconType === "image"
        ? o.titleIconType
        : "none",
    titleIconName: coerceNullableString(o.titleIconName),
    titleIconImageUrl: coerceNullableString(o.titleIconImageUrl),
    titleIconSize:
      o.titleIconSize === "small" || o.titleIconSize === "medium" ? o.titleIconSize : null,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : isoNow(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : isoNow(),
    deletedAt: o.deletedAt === null || o.deletedAt === undefined ? null : coerceNullableString(o.deletedAt),
  };
}

/** 게시 직전: id 유일, sortOrder가 0…n-1 퍼뮤테이션 */
export function assertPublishableDraftSections(page: PageBuilderKey, sections: PageSection[]): void {
  const n = sections.length;
  const ids = new Set<string>();
  for (const s of sections) {
    if (ids.has(s.id)) {
      throw new CmsDraftPublishValidationError("DUPLICATE_ID", `중복된 섹션 id: ${s.id}`);
    }
    ids.add(s.id);
    if (s.page !== page) {
      throw new CmsDraftPublishValidationError(
        "PAGE_MISMATCH",
        `섹션 ${s.id}의 page가 대상 페이지(${page})와 일치하지 않습니다.`
      );
    }
  }

  if (n === 0) return;

  const orders = sections.map((s) => s.sortOrder);
  if (orders.some((x) => !Number.isInteger(x))) {
    throw new CmsDraftPublishValidationError("INVALID_SORT_ORDER", "sortOrder는 정수여야 합니다.");
  }
  const sorted = [...orders].sort((a, b) => a - b);
  for (let i = 0; i < n; i++) {
    if (sorted[i] !== i) {
      throw new CmsDraftPublishValidationError(
        "SORT_ORDER_MISMATCH",
        `sortOrder는 0부터 ${n - 1}까지 각각 한 번씩이어야 합니다. (현재: ${orders.join(", ")})`
      );
    }
  }
}
