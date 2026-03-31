import type { HeroSettings } from "@/lib/hero-settings";
import type { PageSection } from "@/types/page-section";
import { IMAGE_PLACEHOLDER_SRC, sanitizeImageSrc } from "@/lib/image-src";
import { isLegacyHomeHeroCmsBlock } from "@/lib/content/filter-page-blocks-public-view";

/**
 * `ImageSection`과 동일: 데스크톱 열은 `imageUrl`, 비면 PLACEHOLDER.
 * 모바일 전용(`imageUrlMobile`만 있는 경우)은 공개에서 모바일 뷰포트에 보이므로 썸네일에도 반영.
 */
export function cmsImageSectionPreviewSrc(section: PageSection): string {
  if (section.type !== "image") return IMAGE_PLACEHOLDER_SRC;
  const pc = section.imageUrl?.trim() ?? "";
  const mob = section.imageUrlMobile?.trim() ?? "";
  const raw = pc || mob;
  if (!raw) return IMAGE_PLACEHOLDER_SRC;
  return sanitizeImageSrc(raw) ?? IMAGE_PLACEHOLDER_SRC;
}

/** `HomeHero` 정본: 켜져 있고 배경 URL이 있을 때만 (공개와 동일) */
export function heroCanonicalBackgroundPreviewSrc(hero: HeroSettings | null | undefined): string | null {
  if (!hero?.heroEnabled) return null;
  const u = sanitizeImageSrc(hero.heroBackgroundImageUrl);
  return u;
}

/**
 * 콘텐츠 편집 목록 썸네일 — 공개 렌더 기준.
 * - 히어로 슬롯·레거시 메인 비주얼: JSON 히어로 배경만 (DB 섹션 이미지와 무관)
 * - 그 외 이미지 CMS: ImageSection과 동일한 URL 우선순위·sanitize
 */
/** 썸네일용 src. `null`이면 표시 없음(—). 이미지·히어로 관련 행은 항상 문자열(실제 URL 또는 ImageSection과 동일 PLACEHOLDER). */
export function resolvePageSectionListThumbnailSrc(
  section: PageSection,
  heroSettings: HeroSettings | null | undefined
): string | null {
  if (section.slotType === "hero" || isLegacyHomeHeroCmsBlock(section)) {
    return heroCanonicalBackgroundPreviewSrc(heroSettings) ?? IMAGE_PLACEHOLDER_SRC;
  }
  if (section.type === "image") {
    return cmsImageSectionPreviewSrc(section);
  }
  return null;
}
