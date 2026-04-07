"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { cn } from "@/lib/utils";
import { sanitizeImageSrc } from "@/lib/image-src";
import { clampFlowSpeed } from "@/lib/home-carousel-flow";
import { SlotBlockCtaLink } from "@/components/home/SlotBlockCtaLink";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import {
  ctaButtonPlacementWrapClass,
  isOutsideCtaButtonPlacement,
  resolveCtaButtonPlacement,
  resolveSlotBlockCtaConfig,
} from "@/lib/slot-block-cta";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import {
  gapClass,
  tournamentGridUlClass,
  venueCarouselLinkExtraClasses,
  venueGridCardLinkClasses,
  hoverClasses,
} from "@/lib/slot-block-card-style";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { slotMotionEffectiveFlowSpeed } from "@/lib/slot-block-layout-motion";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { HighlightCard } from "@/components/cards/TournamentPublishedCard";
import {
  PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS,
  resolvePlatformCardTemplateStylePolicy,
} from "@/lib/platform-card-templates";

export type VenueCarouselItem = {
  id: string;
  name: string;
  slug: string;
  thumbnailUrl?: string | null;
  imageUrl?: string | null;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  venueCategory?: "daedae_only" | "mixed" | null;
  /** 직접 구성 카드: 부가 설명 */
  manualDescription?: string | null;
  /** 직접 구성 카드: 링크(있으면 venueSlug 자동 연결보다 우선) */
  manualLinkUrl?: string | null;
};

const GAP = 16;
const VENUE_MOTION_START_DELAY_MS = 1700;

/** 모바일 4, 태블릿 5, PC 6~8 */
function getVisibleCount(): number {
  if (typeof window === "undefined") return 6;
  const w = window.innerWidth;
  if (w < 640) return 4;
  if (w < 1024) return 5;
  if (w < 1280) return 6;
  return 8;
}

function gapPxFromStyle(cardStyle: SlotBlockCardStyle | undefined): number {
  if (!cardStyle) return GAP;
  const m: Record<SlotBlockCardStyle["cardGap"], number> = {
    none: 0,
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  };
  return m[cardStyle.cardGap];
}

export function VenueCarousel({
  venues,
  copy,
  homeCarouselFlowSpeed = 50,
  cardStyle,
  ctaConfig,
  slotLayout,
  slotMotion,
  blockBackgroundColor,
  sectionTitle,
}: {
  venues: VenueCarouselItem[];
  copy: Record<string, string>;
  /** 메인 가로 흐름 속도(1~100) — `slotMotion` 없을 때만 */
  homeCarouselFlowSpeed?: number;
  cardStyle?: SlotBlockCardStyle;
  ctaConfig?: SlotBlockCtaConfig;
  slotLayout?: SlotBlockLayout;
  slotMotion?: SlotBlockMotion;
  blockBackgroundColor?: string;
  /** `PageSection` 제목 — 비우면 관리자 문구 */
  sectionTitle?: string | null;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  const headingTitle = sectionTitle?.trim() || getCopyValue(c, "site.home.venues.title");
  const venuePromoStyle = resolvePlatformCardTemplateStylePolicy(
    copy?.[PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.highlight] ?? null,
    "highlight"
  );
  const categoryOptions: { value: "all" | "daedae_only" | "mixed"; label: string }[] = [
    { value: "all", label: getCopyValue(c, "site.home.venues.categoryAll") },
    { value: "daedae_only", label: getCopyValue(c, "site.home.venues.categoryDaedae") },
    { value: "mixed", label: getCopyValue(c, "site.home.venues.categoryMixed") },
  ];
  const cta = ctaConfig ?? resolveSlotBlockCtaConfig("venueIntro", null);
  const buttonPlacement = resolveCtaButtonPlacement(cta.button);
  const outsideButton = isOutsideCtaButtonPlacement(buttonPlacement);
  const topRightButton = buttonPlacement === "headerRight";
  const inlineBottomButton = !outsideButton && !topRightButton;
  const buttonClass = "inline-flex items-center text-sm font-medium text-site-primary hover:underline py-2";
  const buttonLabel = getCopyValue(c, "site.home.venues.btnViewAll");
  const useGrid = slotLayout
    ? slotLayout.type === "grid"
    : Boolean(cardStyle && cardStyle.columns !== "carousel");
  const gridCols =
    slotLayout && slotLayout.type === "grid"
      ? slotLayout.columns
      : cardStyle && cardStyle.columns !== "carousel"
        ? (cardStyle.columns as 1 | 2 | 3 | 4)
        : 1;
  const flowForAutoplay = slotMotion
    ? slotMotionEffectiveFlowSpeed(homeCarouselFlowSpeed, slotMotion)
    : homeCarouselFlowSpeed;
  const pauseOnHoverCarousel = slotMotion?.pauseOnHover ?? true;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [venueFilter, setVenueFilter] = useState<"all" | "daedae_only" | "mixed">("all");
  const [visibleCount, setVisibleCount] = useState(6);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });
  const isDraggingRef = useRef(false);
  const userScrollPauseUntilRef = useRef(0);
  const programmaticScrollRef = useRef(false);
  const currentPageRef = useRef(0);
  const autoplayHoverPauseRef = useRef(false);

  const gapPx = gapPxFromStyle(cardStyle);

  const hideVenueCategoryFilter = venues.some(
    (v) => v.manualLinkUrl != null || (v.manualDescription != null && v.manualDescription !== "")
  );

  const measureStridePx = useCallback(
    (el: HTMLDivElement): number => {
      const first = el.querySelector(":scope > a") as HTMLElement | null;
      if (!first) return 0;
      return first.offsetWidth + gapPx;
    },
    [gapPx]
  );

  const filteredVenues = (() => {
    let list = venues;
    if (venueFilter === "daedae_only") list = venues.filter((v) => v.venueCategory === "daedae_only");
    else if (venueFilter === "mixed") list = venues.filter((v) => v.venueCategory === "mixed");
    return [...list].sort((a, b) => {
      const order = (x: "daedae_only" | "mixed" | null | undefined) =>
        x === "daedae_only" ? 0 : x === "mixed" ? 1 : 2;
      return order(a.venueCategory) - order(b.venueCategory) || a.name.localeCompare(b.name);
    });
  })();

  const updateVisible = useCallback(() => {
    const n = getVisibleCount();
    setVisibleCount(n);
    setTotalPages(Math.max(1, Math.ceil(filteredVenues.length / n)));
  }, [filteredVenues.length]);

  useEffect(() => {
    const id = window.setTimeout(() => setMotionReady(true), VENUE_MOTION_START_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (useGrid) return;
    updateVisible();
    const onResize = () => updateVisible();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateVisible, useGrid]);

  const scrollToPage = useCallback(
    (page: number) => {
      const el = scrollRef.current;
      if (!el || filteredVenues.length === 0) return;
      const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
      const stride = measureStridePx(el);
      if (stride < 1) return;
      const targetScroll = pageIndex * visibleCount * stride;
      programmaticScrollRef.current = true;
      el.scrollTo({ left: targetScroll, behavior: "smooth" });
      setCurrentPage(pageIndex);
      currentPageRef.current = pageIndex;
      window.setTimeout(() => {
        programmaticScrollRef.current = false;
      }, 700);
    },
    [visibleCount, totalPages, filteredVenues.length, measureStridePx]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || filteredVenues.length === 0) return;
    if (!programmaticScrollRef.current) {
      userScrollPauseUntilRef.current = Date.now() + 4500;
    }
    const stride = measureStridePx(el);
    if (stride < 1) return;
    const page = Math.round(el.scrollLeft / (visibleCount * stride));
    const p = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(p);
    currentPageRef.current = p;
  }, [visibleCount, totalPages, filteredVenues.length, measureStridePx]);

  useEffect(() => {
    if (!motionReady) return;
    if (useGrid) return;
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll, useGrid, motionReady]);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  /** 페이지 단위 자동 슬라이드 (속도 설정 → 대기 간격). 1페이지만이면 생략 */
  useEffect(() => {
    if (!motionReady) return;
    if (useGrid) return;
    if (slotMotion && !slotMotion.autoPlay) return;
    if (filteredVenues.length === 0 || totalPages <= 1) return;

    const s = clampFlowSpeed(flowForAutoplay);
    const autoplayMs = Math.round(5200 - (s / 100) * 2700);

    const id = window.setInterval(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (isDraggingRef.current || autoplayHoverPauseRef.current) return;
      if (Date.now() < userScrollPauseUntilRef.current) return;
      const next = (currentPageRef.current + 1) % totalPages;
      scrollToPage(next);
    }, autoplayMs);

    return () => clearInterval(id);
  }, [filteredVenues.length, totalPages, flowForAutoplay, scrollToPage, useGrid, slotMotion, motionReady]);

  const onDragStart = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current.scrollLeft };
  };
  const onDragMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
  };
  const onDragEnd = () => setIsDragging(false);

  if (venues.length === 0) return null;

  const imageUrl = (v: VenueCarouselItem) =>
    (v.thumbnailUrl?.trim() ||
      v.imageUrl?.trim() ||
      v.logoImageUrl?.trim() ||
      v.coverImageUrl?.trim() ||
      "") ||
    null;

  return (
    <section
      style={blockBackgroundColor ? { backgroundColor: blockBackgroundColor } : undefined}
      className={cn(PAGE_CONTENT_PAD_X, "py-8 sm:py-10")}
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SlotBlockCtaLink layer={cta.block} ctx={{}} className="min-w-0 text-left">
            <h2 className="text-xl font-bold text-site-text sm:text-2xl">{headingTitle}</h2>
          </SlotBlockCtaLink>
          <div className="flex flex-wrap items-center gap-3">
            {!hideVenueCategoryFilter ? (
              <select
                value={venueFilter}
                onChange={(e) => {
                  setVenueFilter(e.target.value as "all" | "daedae_only" | "mixed");
                  setCurrentPage(0);
                  currentPageRef.current = 0;
                  scrollRef.current?.scrollTo({ left: 0, behavior: "auto" });
                }}
                className="rounded-md border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:outline-none focus:ring-2 focus:ring-site-primary"
                aria-label={getCopyValue(c, "site.home.venues.filterAria")}
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : null}
            {topRightButton ? (
              <SlotBlockCtaLink layer={cta.button} ctx={{}} className={buttonClass}>
                {buttonLabel}
              </SlotBlockCtaLink>
            ) : null}
          </div>
        </div>

        <div className="relative mt-5">
          {filteredVenues.length === 0 ? (
            <p className="text-site-text-muted text-sm py-6 text-center">
              {venueFilter === "all"
                ? getCopyValue(c, "site.home.venues.empty")
                : getCopyValue(c, "site.home.venues.emptyFiltered").replace(
                    "{label}",
                    categoryOptions.find((o) => o.value === venueFilter)?.label ?? venueFilter
                  )}
            </p>
          ) : useGrid && cardStyle ? (
            <div className={cn("mt-5", tournamentGridUlClass(gridCols, cardStyle))}>
              {filteredVenues.map((v) => (
                <SlotBlockCtaLink
                  key={v.id}
                  layer={cta.card}
                  ctx={{
                    venueSlug: v.slug,
                    itemDirectHref: v.manualLinkUrl?.trim() || undefined,
                  }}
                  className={cn(venueGridCardLinkClasses(cardStyle), "mx-auto w-auto")}
                >
                  <HighlightCard
                    data={{
                      templateType: "highlight",
                      thumbnailUrl: sanitizeImageSrc(imageUrl(v) ?? "") || "",
                      cardTitle: v.name,
                      displayDateText: "",
                      displayRegionText: "",
                      statusText: "",
                      buttonText: "",
                      shortDescription: "",
                    }}
                    stylePolicy={venuePromoStyle}
                    showDetailButton={false}
                  />
                </SlotBlockCtaLink>
              ))}
            </div>
          ) : (
          <>
          {/* 좌우 화살표 - PC */}
          {totalPages > 1 && (
            <>
              <button
                type="button"
                aria-label={getCopyValue(c, "site.home.venues.carouselPrev")}
                onClick={() => scrollToPage(currentPage - 1)}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-site-card shadow-md border border-site-border w-10 h-10 flex items-center justify-center text-site-text hover:bg-site-bg hidden md:flex"
              >
                ←
              </button>
              <button
                type="button"
                aria-label={getCopyValue(c, "site.home.venues.carouselNext")}
                onClick={() => scrollToPage(currentPage + 1)}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-site-card shadow-md border border-site-border w-10 h-10 flex items-center justify-center text-site-text hover:bg-site-bg hidden md:flex"
              >
                →
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className={cn(
              "flex overflow-x-auto overflow-y-hidden pb-2 [&::-webkit-scrollbar]:hidden",
              cardStyle ? gapClass(cardStyle.cardGap) : "gap-4"
            )}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
            onMouseEnter={() => {
              if (pauseOnHoverCarousel) autoplayHoverPauseRef.current = true;
            }}
            onMouseLeave={() => {
              onDragEnd();
              if (pauseOnHoverCarousel) autoplayHoverPauseRef.current = false;
            }}
            onTouchStart={() => {
              if (pauseOnHoverCarousel) autoplayHoverPauseRef.current = true;
            }}
            onTouchEnd={() => {
              if (!pauseOnHoverCarousel) return;
              window.setTimeout(() => {
                autoplayHoverPauseRef.current = false;
              }, 2200);
            }}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
          >
            {filteredVenues.map((v) => (
              <SlotBlockCtaLink
                key={v.id}
                layer={cta.card}
                ctx={{
                  venueSlug: v.slug,
                  itemDirectHref: v.manualLinkUrl?.trim() || undefined,
                }}
                onClick={(e) => {
                  if (isDragging) e.preventDefault();
                }}
                className={cn(
                  "flex flex-col items-center shrink-0 group py-3 px-2 min-h-[120px] active:bg-gray-100/50 dark:active:bg-slate-800/50",
                  cardStyle
                    ? cn(venueCarouselLinkExtraClasses(cardStyle), hoverClasses(cardStyle.hoverEffect))
                    : "rounded-xl"
                )}
              >
                <HighlightCard
                  data={{
                    templateType: "highlight",
                    thumbnailUrl: sanitizeImageSrc(imageUrl(v) ?? "") || "",
                    cardTitle: v.name,
                    displayDateText: "",
                    displayRegionText: "",
                    statusText: "",
                    buttonText: "",
                    shortDescription: "",
                  }}
                  stylePolicy={venuePromoStyle}
                  showDetailButton={false}
                />
              </SlotBlockCtaLink>
            ))}
          </div>

          {/* 페이지 도트 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={getCopyValue(c, "site.home.venues.carouselPageAria").replace(
                    "{n}",
                    String(i + 1)
                  )}
                  onClick={() => scrollToPage(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentPage ? "bg-site-primary scale-125" : "bg-site-border hover:bg-site-text-muted"
                  }`}
                />
              ))}
            </div>
          )}
          </>
          )}
        </div>
        {inlineBottomButton ? (
          <div className={cn("mt-5", ctaButtonPlacementWrapClass(buttonPlacement))}>
            <SlotBlockCtaLink layer={cta.button} ctx={{}} className={buttonClass}>
              {buttonLabel}
            </SlotBlockCtaLink>
          </div>
        ) : null}
      </div>
      {outsideButton ? (
        <div className={cn("mx-auto mt-4 max-w-6xl", ctaButtonPlacementWrapClass(buttonPlacement))}>
          <SlotBlockCtaLink layer={cta.button} ctx={{}} className={buttonClass}>
            {buttonLabel}
          </SlotBlockCtaLink>
        </div>
      ) : null}
    </section>
  );
}
