import type { PageSection, PageSlug } from "@/types/page-section";
import { dedupeHomeStructureSlotBlocks } from "@/lib/home-structure-slots";

/**
 * 공개 `getOrderedPageBlocksForPage`와 동일: 노출·기간 필터. CMS·슬롯 모두 포함.
 */
export function filterPageBlocksForPublicView(rows: PageSection[]): PageSection[] {
  const t = Date.now();
  const inRange = (startAt: string | null, endAt: string | null) => {
    if (startAt && new Date(startAt).getTime() > t) return false;
    if (endAt && new Date(endAt).getTime() < t) return false;
    return true;
  };
  return rows.filter((s) => s.isVisible && !s.deletedAt && inRange(s.startAt, s.endAt));
}

/** 레거시 홈 메인 비주얼 CMS 이미지 — 내용은 `/admin/site/settings` 인트로/상단 설정 정본만 사용 */
export function isLegacyHomeHeroCmsBlock(b: PageSection): boolean {
  return (
    b.page === "home" &&
    !b.slotType &&
    b.placement === "main_visual_bg" &&
    b.type === "image"
  );
}

/** `hero` 슬롯이 둘 이상이면 JSON 히어로가 중복 렌더되므로 첫 번째만 유지 */
export function dedupeHeroSlotBlocks(blocks: PageSection[]): PageSection[] {
  let heroKept = false;
  return blocks.filter((b) => {
    if (b.slotType !== "hero") return true;
    if (heroKept) return false;
    heroKept = true;
    return true;
  });
}

/**
 * 공개 `PageRenderer` 직전 적용: 홈 레거시 히어로 CMS 행 제거 + hero 슬롯 단일화.
 * (마이그레이션 후에도 동일하게 안전)
 */
export function applyPublicHeroSingleCanonical(page: PageSlug, blocks: PageSection[]): PageSection[] {
  let out = blocks;
  if (page === "home") {
    out = out.filter((b) => !isLegacyHomeHeroCmsBlock(b));
    out = dedupeHomeStructureSlotBlocks(out);
  }
  return dedupeHeroSlotBlocks(out);
}
