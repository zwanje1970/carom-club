"use client";

import { useEffect, useState } from "react";
import { PageRenderer } from "@/components/content/PageRenderer";
import type { PageSection } from "@/types/page-section";
import type { PageSlotRenderContext } from "@/types/page-slot-render-context";

const FIRST_DEFER_DELAY_MS = 1400;
const NEXT_DEFER_STEP_MS = 900;

/**
 * 첫 화면에 보이지 않는 하단 블록은 하이드레이션 이후 붙여
 * 초기 렌더/페인트 부담을 줄인다.
 */
export function HomeDeferredBlocks({
  blocks,
  slotContext,
}: {
  blocks: PageSection[];
  slotContext: PageSlotRenderContext;
}) {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (blocks.length === 0) return;
    setVisibleCount(0);
    const firstId = window.setTimeout(() => {
      setVisibleCount(1);
    }, FIRST_DEFER_DELAY_MS);
    return () => window.clearTimeout(firstId);
  }, [blocks]);

  useEffect(() => {
    if (blocks.length === 0) return;
    if (visibleCount === 0) return;
    if (visibleCount >= blocks.length) return;
    const stepId = window.setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + 1, blocks.length));
    }, NEXT_DEFER_STEP_MS);
    return () => window.clearTimeout(stepId);
  }, [visibleCount, blocks.length]);

  if (blocks.length === 0 || visibleCount === 0) return null;
  return <PageRenderer blocks={blocks.slice(0, visibleCount)} slotContext={slotContext} />;
}

