"use client";

import type { PageSection } from "@/types/page-section";
import type { PageSlotRenderContext } from "@/types/page-slot-render-context";
import { PageSectionBlockRow } from "@/components/content/PageSectionBlockRow";
import { PageSlotBlock, type PageSlotSurface } from "@/components/content/PageSlotBlock";

type Props = {
  /**
   * 페이지별 섹션 배열(정렬된 순서). CMS 행 + slotType 행 혼합.
   */
  blocks?: PageSection[] | null;
  /** 슬롯 렌더에 필요한 데이터(히어로 설정·커뮤니티 목록·대회 목록 등) */
  slotContext?: PageSlotRenderContext | null;
  /**
   * `public`: 미연결 슬롯(퀵메뉴·캐러셀·알 수 없는 타입 등)은 UI 없음.
   * `adminPreview`: 관리자 미리보기에서만 점선 안내(SlotFallback) 표시.
   */
  slotSurface?: PageSlotSurface;
  selectedBlockId?: string | null;
  onBlockClick?: (blockId: string) => void;
};

/**
 * CMS 행(`PageSectionBlockRow`)과 구조 슬롯(`PageSlotBlock`)을 한 루프에서 처리.
 * 공개 페이지와 관리자 미리보기가 동일 컴포넌트를 쓰고, `slotSurface`만 다르다.
 */
export function PageRenderer({
  blocks,
  slotContext,
  slotSurface = "public",
  selectedBlockId = null,
  onBlockClick,
}: Props) {
  const list = Array.isArray(blocks) ? blocks : [];
  if (list.length === 0) return null;

  return (
    <>
      {list.map((block) => {
        const body = block.slotType ? (
          <PageSlotBlock
            key={block.id}
            block={block}
            ctx={slotContext ?? undefined}
            surface={slotSurface}
          />
        ) : (
          <PageSectionBlockRow key={block.id} section={block} />
        );
        const isSelected = selectedBlockId === block.id;
        return (
          <div
            key={block.id}
            data-block-id={block.id}
            onClick={() => onBlockClick?.(block.id)}
            className={`relative ${
              isSelected ? "outline outline-2 outline-site-primary outline-offset-[-2px]" : ""
            } ${onBlockClick ? "cursor-pointer" : ""}`}
          >
            {body}
          </div>
        );
      })}
    </>
  );
}
