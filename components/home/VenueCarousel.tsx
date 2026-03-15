"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

export type VenueCarouselItem = {
  id: string;
  name: string;
  slug: string;
  logoImageUrl: string | null;
  coverImageUrl: string | null;
  venueCategory?: "daedae_only" | "mixed" | null;
};

const VENUE_CATEGORY_OPTIONS: { value: "all" | "daedae_only" | "mixed"; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "daedae_only", label: "대대전용" },
  { value: "mixed", label: "복합구장" },
];

const GAP = 16;

/** 모바일 4, 태블릿 5, PC 6~8 */
function getVisibleCount(): number {
  if (typeof window === "undefined") return 6;
  const w = window.innerWidth;
  if (w < 640) return 4;
  if (w < 1024) return 5;
  if (w < 1280) return 6;
  return 8;
}

export function VenueCarousel({ venues }: { venues: VenueCarouselItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [venueFilter, setVenueFilter] = useState<"all" | "daedae_only" | "mixed">("all");
  const [visibleCount, setVisibleCount] = useState(6);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

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
    updateVisible();
    const onResize = () => updateVisible();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateVisible]);

  const scrollToPage = useCallback(
    (page: number) => {
      const el = scrollRef.current;
      if (!el || filteredVenues.length === 0) return;
      const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
      const cardWidth = (el.scrollWidth - GAP * (visibleCount - 1)) / visibleCount;
      const targetScroll = pageIndex * visibleCount * (cardWidth + GAP);
      el.scrollTo({ left: targetScroll, behavior: "smooth" });
      setCurrentPage(pageIndex);
    },
    [visibleCount, totalPages, filteredVenues.length]
  );

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || filteredVenues.length === 0) return;
    const cardWidth = (el.scrollWidth - GAP * (visibleCount - 1)) / visibleCount;
    const page = Math.round(el.scrollLeft / (cardWidth + GAP));
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  }, [visibleCount, totalPages, filteredVenues.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

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
    (v.logoImageUrl?.trim() || v.coverImageUrl?.trim() || "") || null;

  return (
    <section className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">당구장 소개</h2>
          <select
            value={venueFilter}
            onChange={(e) => {
              setVenueFilter(e.target.value as "all" | "daedae_only" | "mixed");
              setCurrentPage(0);
            }}
            className="rounded-md border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:outline-none focus:ring-2 focus:ring-site-primary"
            aria-label="당구장 구분"
          >
            {VENUE_CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="relative mt-5">
          {filteredVenues.length === 0 ? (
            <p className="text-site-text-muted text-sm py-6 text-center">
              {venueFilter === "all" ? "등록된 당구장이 없습니다." : `해당 구분의 당구장이 없습니다. (${VENUE_CATEGORY_OPTIONS.find((o) => o.value === venueFilter)?.label ?? venueFilter})`}
            </p>
          ) : (
          <>
          {/* 좌우 화살표 - PC */}
          {totalPages > 1 && (
            <>
              <button
                type="button"
                aria-label="이전"
                onClick={() => scrollToPage(currentPage - 1)}
                className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-site-card shadow-md border border-site-border w-10 h-10 flex items-center justify-center text-site-text hover:bg-site-bg hidden md:flex"
              >
                ←
              </button>
              <button
                type="button"
                aria-label="다음"
                onClick={() => scrollToPage(currentPage + 1)}
                className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-site-card shadow-md border border-site-border w-10 h-10 flex items-center justify-center text-site-text hover:bg-site-bg hidden md:flex"
              >
                →
              </button>
            </>
          )}

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth [&::-webkit-scrollbar]:hidden"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
            }}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseLeave={onDragEnd}
            onMouseUp={onDragEnd}
          >
            {filteredVenues.map((v) => (
              <Link
                key={v.id}
                href={`/v/${v.slug}`}
                onClick={(e) => isDragging && e.preventDefault()}
                className="flex flex-col items-center shrink-0 snap-start w-[calc((100%-3*1rem)/4)] min-w-[calc((100%-3*1rem)/4)] sm:w-[calc((100%-4*1rem)/5)] sm:min-w-[calc((100%-4*1rem)/5)] md:w-[calc((100%-5*1rem)/6)] md:min-w-[calc((100%-5*1rem)/6)] lg:w-[calc((100%-7*1rem)/8)] lg:min-w-[calc((100%-7*1rem)/8)] max-w-[140px] group"
              >
                <div className="relative w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-full overflow-hidden bg-site-bg border border-site-border flex-shrink-0 transition-transform duration-200 group-hover:scale-105">
                  {imageUrl(v) ? (
                    <Image
                      src={imageUrl(v)!}
                      alt=""
                      fill
                      sizes="96px"
                      className="object-cover"
                      loading="lazy"
                      unoptimized={!imageUrl(v)!.startsWith("/") && !imageUrl(v)!.includes("vercel-storage")}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-2xl text-site-text-muted" aria-hidden>
                      ●
                    </span>
                  )}
                </div>
                <p className="mt-2 text-center text-sm font-medium text-site-text line-clamp-2 break-words w-full px-0.5">
                  {v.name}
                </p>
              </Link>
            ))}
          </div>

          {/* 페이지 도트 */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1}페이지`}
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
      </div>
    </section>
  );
}
