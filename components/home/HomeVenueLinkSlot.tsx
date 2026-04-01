"use client";

import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { SlotBlockCtaLink } from "@/components/home/SlotBlockCtaLink";
import { cn } from "@/lib/utils";
import { IMAGE_PLACEHOLDER_SRC, sanitizeImageSrc } from "@/lib/image-src";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import {
  gapClass,
  venueLinkShellClasses,
  tournamentCardLinkClasses,
  tournamentPosterShellClasses,
  tournamentGridUlClass,
} from "@/lib/slot-block-card-style";
import type { SlotBlockCtaConfig, SlotBlockCtaLayer } from "@/lib/slot-block-cta";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import type { SlotBlockItemsBundle, SlotBlockManualItem } from "@/lib/slot-block-items";
import { HomeTournamentListAutoScroll } from "@/components/home/HomeTournamentListAutoScroll";
import { slotMotionEffectiveFlowSpeed } from "@/lib/slot-block-layout-motion";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";

function ManualVenueLinkCard({
  item,
  cardStyle,
  cardCta,
  titleFallback,
}: {
  item: SlotBlockManualItem;
  cardStyle: SlotBlockCardStyle;
  cardCta: SlotBlockCtaLayer | undefined;
  titleFallback: string;
}) {
  const src = sanitizeImageSrc(item.imageUrl?.trim() ?? "");
  return (
    <SlotBlockCtaLink
      layer={cardCta}
      ctx={{ itemDirectHref: item.linkUrl?.trim() || undefined }}
      className={cn("flex min-w-0 flex-col overflow-hidden", tournamentCardLinkClasses(cardStyle))}
    >
      <div className={tournamentPosterShellClasses(cardStyle)}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- 외부·업로드 URL 혼합
          <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" loading="lazy" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={IMAGE_PLACEHOLDER_SRC}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            loading="lazy"
          />
        )}
      </div>
      <div className="flex min-h-[4rem] flex-1 flex-col gap-1 p-3">
        <h3 className="text-sm font-semibold text-site-text line-clamp-2">{item.title || titleFallback}</h3>
        {item.description?.trim() ? (
          <p className="text-xs text-site-text-muted line-clamp-3">{item.description}</p>
        ) : null}
        {item.buttonLabel?.trim() ? (
          <span className="mt-auto text-xs font-medium text-site-primary">{item.buttonLabel}</span>
        ) : null}
      </div>
    </SlotBlockCtaLink>
  );
}

/** 홈 `venueLink` — 자동: 단일 블록 링크 / 직접 구성: 카드 목록 */
export function HomeVenueLinkSlot({
  copy,
  cardStyle,
  ctaConfig,
  slotLayout,
  slotMotion,
  blockBackgroundColor,
  slotItems,
  homeCarouselFlowSpeed,
}: {
  copy: Record<string, string>;
  cardStyle: SlotBlockCardStyle;
  ctaConfig: SlotBlockCtaConfig;
  slotLayout: SlotBlockLayout;
  slotMotion: SlotBlockMotion;
  blockBackgroundColor?: string;
  slotItems: SlotBlockItemsBundle;
  homeCarouselFlowSpeed: number;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  const titleFallback = getCopyValue(c, "site.home.venues.manualTitleFallback");
  const sectionStyle = blockBackgroundColor ? { backgroundColor: blockBackgroundColor } : undefined;
  const flowOneToHundred = slotMotionEffectiveFlowSpeed(homeCarouselFlowSpeed, slotMotion);
  const isCarousel = slotLayout.type === "carousel";
  const gridCols = slotLayout.type === "grid" ? slotLayout.columns : 3;
  const cardCta = ctaConfig.card ?? ctaConfig.block;

  if (slotItems.mode !== "manual" || slotItems.items.length === 0) {
    return (
      <section style={sectionStyle} className={cn(PAGE_CONTENT_PAD_X, "py-6 sm:py-8")}>
        <PageContentContainer
          maxWidthClass="max-w-5xl"
          className={cn("flex flex-wrap justify-center text-sm", gapClass(cardStyle.cardGap))}
        >
          <div className={venueLinkShellClasses(cardStyle)}>
            <SlotBlockCtaLink
              layer={ctaConfig.block}
              ctx={{}}
              className="text-site-primary hover:underline font-medium"
            >
              {getCopyValue(c, "site.home.venues.linkVenueListCta")}
            </SlotBlockCtaLink>
          </div>
        </PageContentContainer>
      </section>
    );
  }

  const items = slotItems.items;

  if (isCarousel) {
    const row = (
      <ul className={cn("flex w-max min-w-0 flex-nowrap", gapClass(cardStyle.cardGap))}>
        {items.map((it) => (
          <li key={it.id} className="w-[220px] min-w-[220px] shrink-0 sm:w-[240px] sm:min-w-[240px]">
            <ManualVenueLinkCard
              item={it}
              cardStyle={cardStyle}
              cardCta={cardCta}
              titleFallback={titleFallback}
            />
          </li>
        ))}
      </ul>
    );
    return (
      <section style={sectionStyle} className={cn(PAGE_CONTENT_PAD_X, "py-6 sm:py-8")}>
        <PageContentContainer maxWidthClass="max-w-5xl" className="min-h-[120px]">
          {slotMotion.autoPlay ? (
            <HomeTournamentListAutoScroll flowSpeed={flowOneToHundred} pauseOnHover={slotMotion.pauseOnHover}>
              {row}
            </HomeTournamentListAutoScroll>
          ) : (
            <div className="-mx-2 flex min-h-[120px] overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {row}
            </div>
          )}
        </PageContentContainer>
      </section>
    );
  }

  return (
    <section style={sectionStyle} className={cn(PAGE_CONTENT_PAD_X, "py-6 sm:py-8")}>
      <PageContentContainer maxWidthClass="max-w-5xl">
        <ul className={cn(tournamentGridUlClass(gridCols, cardStyle), "w-full")}>
          {items.map((it) => (
            <li key={it.id} className="min-w-0">
              <ManualVenueLinkCard
                item={it}
                cardStyle={cardStyle}
                cardCta={cardCta}
                titleFallback={titleFallback}
              />
            </li>
          ))}
        </ul>
      </PageContentContainer>
    </section>
  );
}
