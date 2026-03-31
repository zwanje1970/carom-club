"use client";

import { VenueCarousel, type VenueCarouselItem } from "@/components/home/VenueCarousel";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import type { SlotBlockItemsBundle } from "@/lib/slot-block-items";
import { manualItemsToVenueCarouselItems } from "@/lib/slot-block-items";

/** 홈 `venueIntro` 슬롯 — `PageSlotBlock`에서만 마운트 */
export function HomeVenueIntroSlot({
  venues,
  homeCarouselFlowSpeed = 50,
  cardStyle,
  ctaConfig,
  slotLayout,
  slotMotion,
  blockBackgroundColor,
  slotItems,
}: {
  venues: VenueCarouselItem[];
  /** `slotMotion`이 없을 때만 페이지 자동 슬라이드 간격에 사용 */
  homeCarouselFlowSpeed?: number;
  cardStyle?: SlotBlockCardStyle;
  ctaConfig?: SlotBlockCtaConfig;
  slotLayout: SlotBlockLayout;
  slotMotion: SlotBlockMotion;
  blockBackgroundColor?: string;
  slotItems: SlotBlockItemsBundle;
}) {
  const list =
    slotItems.mode === "manual" && slotItems.items.length > 0
      ? manualItemsToVenueCarouselItems(slotItems.items)
      : venues;

  if (list.length === 0) return null;

  return (
    <VenueCarousel
      venues={list}
      homeCarouselFlowSpeed={homeCarouselFlowSpeed}
      cardStyle={cardStyle}
      ctaConfig={ctaConfig}
      slotLayout={slotLayout}
      slotMotion={slotMotion}
      blockBackgroundColor={blockBackgroundColor}
    />
  );
}
