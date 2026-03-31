/**
 * CMS v2 목표 스키마 — 운영자 UI·저장소 정규화용.
 * 현재 DB는 단계적으로 이 모델로 수렴; 기존 PageSection과 병행 가능하도록 설계.
 */
import type { PageSlug } from "@/types/page-section";

/** 관리자가 선택하는 페이지 키 (1단계: home 중심) */
export type CmsPageKey = Extract<PageSlug, "home" | "community" | "tournaments">;

export type CmsPublishState = "draft" | "published";

export type CmsBlockKind =
  | "hero"
  | "cmsText"
  | "cmsImage"
  | "cmsCta"
  | "cardStrip"
  /** 홈 구조 슬롯 등 — 내부 코드명은 UI에 노출하지 않음 */
  | "structureSlot";

export type CardDataMode = "auto" | "manual" | "mixed";

export type CmsAutoSource = "tournaments" | "venues" | "lessons" | "posts";

export type CmsBlockMotionPreset = "none" | "slide" | "fade" | "scale" | "lift";

/** 목표 블록 편집 단위 (저장소는 추후 JSON 컬럼 또는 별도 테이블) */
export type CmsBlockDraft = {
  id: string;
  kind: CmsBlockKind;
  publishState: CmsPublishState;
  order: number;
  visible: boolean;
  /** 레이아웃·스타일 (WYSIWYG 외) */
  layout: {
    widthMode: "auto" | "custom";
    widthPx?: number;
    shape: "fullBleed" | "boxed";
    background: { type: "none" | "color" | "image"; color?: string; imageUrl?: string | null };
    border?: { width: number; color: string; radius: string };
  };
  contentHtml?: string;
  /** 카드 미사용 시에도 CTA만 블록에 직접 붙일 수 있음 */
  cta?: {
    internalPath?: string | null;
    externalUrl?: string | null;
    openInNewTab?: boolean;
  };
  cardsEnabled: boolean;
  cardDataMode?: CardDataMode;
  autoSource?: CmsAutoSource;
  autoSort?: "latest" | "popular" | "featured";
  autoLimit?: number;
  motion?: {
    preset: CmsBlockMotionPreset;
    speed?: "slow" | "normal" | "fast";
    direction?: "ltr" | "rtl";
    autoplay?: boolean;
    pauseOnHover?: boolean;
  };
};

export type CmsPageDraft = {
  page: CmsPageKey;
  blocks: CmsBlockDraft[];
  updatedAt: string;
};
