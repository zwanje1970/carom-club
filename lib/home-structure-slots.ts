import type { PageSection } from "@/types/page-section";

/**
 * 홈 구조 슬롯 4종. 마이그레이션 `20260329160000_home_page_structure_slots`가 홈에 누락된 행을 보강한다.
 * 공개 홈 본문은 `PageRenderer` + `buildHomeSlotRenderPayload`만 사용한다(구 `HomeDeferredSections` 제거).
 *
 * 운영 역할(고정):
 * - 페이지 빌더: 슬롯 순서·노출 + `slotBlockCard` / `slotBlockCta`
 * - 콘텐츠(섹션) 편집: CMS 텍스트·이미지·버튼 등 행 데이터
 * - 사이트 관리(/admin/site): 히어로 JSON·푸터 등 전역 설정
 */
export const HOME_STRUCTURE_SLOT_TYPES = [
  "tournamentIntro",
  "venueIntro",
  "venueLink",
  "nanguEntry",
] as const;

export type HomeStructureSlotType = (typeof HOME_STRUCTURE_SLOT_TYPES)[number];

/** DB/JSON에서 앞뒤 공백이 붙어도 동일 슬롯으로 인식 */
export function normalizeHomeStructureSlotType(
  v: string | null | undefined
): HomeStructureSlotType | null {
  if (v == null) return null;
  const t = String(v).trim();
  return (HOME_STRUCTURE_SLOT_TYPES as readonly string[]).includes(t) ? (t as HomeStructureSlotType) : null;
}

export function isHomeStructureSlotType(
  v: string | null | undefined
): v is HomeStructureSlotType {
  return normalizeHomeStructureSlotType(v) != null;
}

/** 동일 홈 구조 슬롯이 중복 행이면 정렬 순 첫 행만 공개 렌더(복제 실수 시 UI 이중 노출 방지) */
export function dedupeHomeStructureSlotBlocks(blocks: PageSection[]): PageSection[] {
  const seen = new Set<string>();
  const out: PageSection[] = [];
  for (const b of blocks) {
    const key = normalizeHomeStructureSlotType(b.slotType);
    if (!key) {
      out.push(b);
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}
