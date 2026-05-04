"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent, Ref } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import editorCardStyles from "../client/tournaments/[id]/card-publish-editor.module.css";
import styles from "./main-sample/main-sample.module.css";
import siteStyles from "./main-site-scroll-cards.module.css";
import { PublishedSnapshotScrollCard } from "./published-snapshot-scroll-card";
import {
  SLIDE_DECK_SOLID_BACKDROPS,
  TournamentSnapshotCardView,
  type SlideDeckItem,
} from "./tournament-snapshot-card-view";

const SITE_SCROLL_CARD = "data-site-scroll-card";
const SITE_SCROLL_SHORTCUT = "data-site-scroll-shortcut";

export type MainSiteScrollCardItem = {
  id: string;
  href: string;
  title: string;
  imageUrl: string | null;
  /** 이미지 없을 때 카드 면 배경(CSS `background` 값) */
  faceCssBackground: string | null;
  external: boolean;
  /** 게시 스냅샷으로 면 전체가 이미지일 때 제목 오버레이 숨김(중복 방지) */
  faceIsFullPublishedSnapshot?: boolean;
  /** 게시 PNG 면에서 배지·제목·메타 오버레이 생략(메인 대회 카드 전용; 광고는 미설정) */
  suppressPublishedScrollOverlay?: boolean;
  /**
   * 게시 PNG 분기(`faceIsFullPublishedSnapshot`)는 아니지만, 면·포스터 크기·비율은
   * 게시 카드와 동일 CSS(공통 토큰) 사용 — 광고 업로드 이미지 전용.
   */
  faceMatchPublishedScrollMetrics?: boolean;
  /** 게시/광고 풀면레이아웃: HTML 텍스트(배지·제목·부가) — 이미지는 배경만 */
  scrollFaceBadge?: string | null;
  scrollFaceSubtitle?: string | null;
  scrollFaceExtraLine1?: string | null;
  scrollFaceExtraLine2?: string | null;
  scrollFaceExtraLine3?: string | null;
  scrollFaceTitleColor?: string | null;
  scrollFaceMetaColor?: string | null;
  scrollFaceStrongTextShadow?: boolean;
  /** 대회 카드: 작성화면과 동일 컴포넌트로 렌더(광고 등은 미사용) */
  slideDeckItem?: SlideDeckItem;
};

function isMainSiteScrollAdRow(item: MainSiteScrollCardItem): boolean {
  if (item.slideDeckItem?.type === "ad") return true;
  if (item.scrollFaceBadge?.trim() === "광고") return true;
  return false;
}

function publishedScrollBadgeClass(badge: string): string {
  const b = badge.trim();
  if (!b) return "site-board-status-badge site-board-status-badge--muted";
  if (b === "광고") return "site-board-status-badge site-board-status-badge--muted";
  if (b.includes("마감임박") || (b.includes("마감") && b.includes("임박")))
    return "site-board-status-badge site-board-status-badge--urgent";
  if (b.includes("마감")) return "site-board-status-badge site-board-status-badge--closed";
  if (b.includes("종료")) return "site-board-status-badge site-board-status-badge--ended";
  if (b.includes("모집") || b.includes("진행")) return "site-board-status-badge badge-status";
  return "site-board-status-badge site-board-status-badge--muted";
}

function isDudMetaLine(s: string): boolean {
  const t = s.trim();
  if (!t) return true;
  return /^[·\s.|\-–—]+$/u.test(t);
}

function publishedScrollMetaLines(
  subtitle: string | null | undefined,
  e1: string | null | undefined,
  e2: string | null | undefined,
  e3: string | null | undefined,
): string[] {
  const out: string[] = [];
  const pushUnique = (s: string) => {
    const t = s.trim();
    if (!t || isDudMetaLine(t) || out.includes(t)) return;
    out.push(t);
  };
  pushUnique(subtitle ?? "");
  pushUnique(e1 ?? "");
  pushUnique(e2 ?? "");
  pushUnique(e3 ?? "");
  return out.slice(0, 3);
}

type CardRowProps = {
  rowKey: string;
  item: MainSiteScrollCardItem;
  selected: boolean;
  onCardPointerDown: (itemId: string) => void;
  /** 문서 순서상 첫 번째 면 이미지(LCP 후보) — 링크 preload 없이 img 우선순위만 부여 */
  lcpHeroImage?: boolean;
};

const MainSiteCardRow = memo(function MainSiteCardRow({
  rowKey,
  item,
  selected,
  onCardPointerDown,
  lcpHeroImage = false,
}: CardRowProps) {
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(`[${SITE_SCROLL_SHORTCUT}]`)) return;
      if (t?.closest("a[href]")) return;
      onCardPointerDown(item.id);
    },
    [item.id, onCardPointerDown],
  );

  if (item.slideDeckItem) {
    const sd = item.slideDeckItem;
    const deckInner = (
      <TournamentSnapshotCardView
        item={sd}
        slideDeck
        templateCardLayout
        editorCompactCardHeight
        suppressLink
        repImageHighPriority={lcpHeroImage}
        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
      />
    );
    return (
      <div
        className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
        {...{ [SITE_SCROLL_CARD]: "" }}
        {...(isMainSiteScrollAdRow(item) ? { "data-site-main-scroll-ad": "1" } : {})}
        style={{ touchAction: "pan-y" }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onCardPointerDown(item.id);
        }}
      >
        <div
          className={`${styles.sampleMainCardFace} ${styles.sampleMainCardFaceTournamentDeck} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
        >
          <div className={siteStyles.cardRowInteractionWrap} onPointerDown={onPointerDown}>
            <div className={styles.sampleMainCardDeckFit}>
              <div className={styles.sampleMainCardDeckFitInner}>
                <div className={editorCardStyles.previewCardScaleHost}>
                  <div className={editorCardStyles.previewCardScaleInner}>
                    <div
                      className={`${editorCardStyles.previewCardWrap} ${editorCardStyles.previewCardWrapV2Chrome}`}
                    >
                      <div className={editorCardStyles.cardPublishCaptureRoot}>{deckInner}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {selected ? (
            item.external ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.sampleMainCardShortcut}
                {...{ [SITE_SCROLL_SHORTCUT]: "" }}
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
              >
                자세히 보기 ▶
              </a>
            ) : (
              <Link
                href={item.href}
                prefetch={false}
                className={styles.sampleMainCardShortcut}
                {...{ [SITE_SCROLL_SHORTCUT]: "" }}
                tabIndex={0}
                onPointerDown={(e) => e.stopPropagation()}
              >
                자세히 보기 ▶
              </Link>
            )
          ) : null}
        </div>
      </div>
    );
  }

  const hasFaceImage = Boolean(item.imageUrl?.trim());
  const isPublishedSnapshotEnabled =
    process.env.NEXT_PUBLIC_ENABLE_PUBLISHED_SNAPSHOT === "true";
  /** 대회 게시 PNG 플랫 카드(메인 전용, 오버레이 없음) — 광고·HTML 덱과 분리 */
  const isPublishedSnapshotImageOnlyCard =
    isPublishedSnapshotEnabled &&
    Boolean(item.faceIsFullPublishedSnapshot) &&
    hasFaceImage &&
    item.suppressPublishedScrollOverlay === true;

  if (isPublishedSnapshotImageOnlyCard && item.imageUrl?.trim()) {
    return (
      <div
        className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
        {...{ [SITE_SCROLL_CARD]: "", "data-published-snapshot-card-slot": "" }}
        {...(isMainSiteScrollAdRow(item) ? { "data-site-main-scroll-ad": "1" } : {})}
        style={{ touchAction: "pan-y" }}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
        onPointerDown={onPointerDown}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onCardPointerDown(item.id);
        }}
      >
        <PublishedSnapshotScrollCard
          imageUrl={item.imageUrl.trim()}
          href={item.href}
          title={item.title}
          alt={item.title}
          external={item.external}
          selected={selected}
          lcpHeroImage={lcpHeroImage}
        />
      </div>
    );
  }

  const usePublishedScrollLayout = Boolean(
    (item.faceIsFullPublishedSnapshot && hasFaceImage) ||
      (item.faceMatchPublishedScrollMetrics && hasFaceImage),
  );

  const faceStyle: CSSProperties = {};
  if (!item.imageUrl?.trim() && item.faceCssBackground?.trim()) {
    faceStyle.background = item.faceCssBackground.trim();
  }

  const textShadowBase = item.scrollFaceStrongTextShadow
    ? "0 1px 2px rgba(0,0,0,0.75), 0 2px 8px rgba(0,0,0,0.45)"
    : "0 1px 2px rgba(0,0,0,0.65)";
  const titleColor = item.scrollFaceTitleColor?.trim() || "#ffffff";
  const metaColor = item.scrollFaceMetaColor?.trim() || "rgba(255,255,255,0.92)";
  const metaLines = publishedScrollMetaLines(
    item.scrollFaceSubtitle,
    item.scrollFaceExtraLine1,
    item.scrollFaceExtraLine2,
    item.scrollFaceExtraLine3,
  );
  const overlayTextShadow = item.scrollFaceStrongTextShadow ? textShadowBase : "none";

  return (
    <div
      className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
      {...{ [SITE_SCROLL_CARD]: "" }}
      {...(isMainSiteScrollAdRow(item) ? { "data-site-main-scroll-ad": "1" } : {})}
      style={{ touchAction: "pan-y" }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onCardPointerDown(item.id);
      }}
    >
      <div
        className={
          usePublishedScrollLayout
            ? [
                styles.sampleMainCardFacePublishedSnapshot,
                selected ? styles.sampleMainCardFacePublishedSnapshotSelected : "",
                item.suppressPublishedScrollOverlay ? styles.sampleMainCardFacePublishedSnapshotImageOnly : "",
              ]
                .filter(Boolean)
                .join(" ")
            : `${styles.sampleMainCardFace} ${selected ? styles.sampleMainCardFaceSelected : ""}`
        }
        style={faceStyle}
      >
        {usePublishedScrollLayout && item.imageUrl?.trim() ? (
          <div className={styles.sampleMainCardPublishedInner}>
            <img
              src={item.imageUrl.trim()}
              alt=""
              className={styles.sampleMainCardPosterPublishedSnapshot}
              decoding="async"
              loading={lcpHeroImage ? "eager" : "lazy"}
              {...(lcpHeroImage ? { fetchPriority: "high" as const } : {})}
            />
            <div className={styles.sampleMainCardPublishedOverlay} aria-hidden>
              {item.scrollFaceBadge?.trim() ? (
                <span className={publishedScrollBadgeClass(item.scrollFaceBadge.trim())}>
                  {item.scrollFaceBadge.trim()}
                </span>
              ) : null}
              <p
                className={styles.sampleMainCardPublishedOverlayTitle}
                style={{ color: titleColor, textShadow: overlayTextShadow }}
              >
                {item.title}
              </p>
              {metaLines.map((line, idx) => (
                <p
                  key={`${idx}-${line}`}
                  className={styles.sampleMainCardPublishedOverlayMeta}
                  style={{ color: metaColor, textShadow: overlayTextShadow }}
                >
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : item.imageUrl?.trim() ? (
          <img
            src={item.imageUrl.trim()}
            alt=""
            className={styles.sampleMainCardPoster}
            decoding="async"
            loading={lcpHeroImage ? "eager" : "lazy"}
            {...(lcpHeroImage ? { fetchPriority: "high" as const } : {})}
          />
        ) : null}
        {!usePublishedScrollLayout ? (
          <div className={styles.sampleMainCardTitleOverlay}>{item.title}</div>
        ) : null}
        {item.external ? (
          <a
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.sampleMainCardShortcut}
            {...{ [SITE_SCROLL_SHORTCUT]: "" }}
            tabIndex={selected ? 0 : -1}
            aria-hidden={!selected}
            onPointerDown={(e) => e.stopPropagation()}
          >
            자세히 보기 ▶
          </a>
        ) : (
          <Link
            href={item.href}
            prefetch={false}
            className={styles.sampleMainCardShortcut}
            {...{ [SITE_SCROLL_SHORTCUT]: "" }}
            tabIndex={selected ? 0 : -1}
            aria-hidden={!selected}
            onPointerDown={(e) => e.stopPropagation()}
          >
            자세히 보기 ▶
          </Link>
        )}
      </div>
    </div>
  );
});

export type MainSiteScrollCardsProps = {
  items: MainSiteScrollCardItem[];
  slideCardMoveDurationSec: number;
};

export function MainSiteScrollCards({ items, slideCardMoveDurationSec }: MainSiteScrollCardsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const primarySegmentRef = useRef<HTMLDivElement | null>(null);
  const secondarySegmentRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const pausedByUserRef = useRef(false);
  const programmaticScrollUntilMsRef = useRef(0);
  /** `pxPerSec * dt` 소수 누적 — `scrollTop`에는 정수 px만 반영해 미세 떨림 완화 */
  const scrollPixelCarryRef = useRef(0);

  const lcpHeroItemIndex = useMemo(
    () =>
      items.findIndex(
        (x) =>
          Boolean(x.imageUrl?.trim()) ||
          Boolean(
            x.slideDeckItem &&
              (x.slideDeckItem.image320Url?.trim() ||
                (typeof x.slideDeckItem.mediaBackground === "string" && x.slideDeckItem.mediaBackground.trim())),
          ),
      ),
    [items],
  );

  const onCardPointerDown = useCallback((itemId: string) => {
    setSelectedItemId((prev) => {
      if (prev === null) return itemId;
      if (prev === itemId) return null;
      return null;
    });
  }, []);

  const onViewportPointerDownCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (selectedItemId === null) return;
      const el = e.target as HTMLElement | null;
      if (!el || el.closest(`[${SITE_SCROLL_CARD}]`)) return;
      setSelectedItemId(null);
    },
    [selectedItemId],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (items.length === 0) return;

    const durationSec = Number.isFinite(slideCardMoveDurationSec)
      ? Math.max(1, slideCardMoveDurationSec)
      : 10;
    const fallbackPxPerSec = 24;
    const restartAfterUserInputMs = 2000;
    const readSegmentHeight = () => {
      const raw = primarySegmentRef.current?.scrollHeight ?? 0;
      return Number.isFinite(raw) && raw > 0 ? raw : 0;
    };

    /** primary 세그먼트 내 카드 슬롯(행) 높이 누적 — `cardMoveDurationSec`는 "행 1개 높이당 초"로만 사용 */
    type CardLayoutMetrics = {
      tops: number[];
      heights: number[];
      segmentHeight: number;
    };
    let cardLayoutMetrics: CardLayoutMetrics | null = null;
    let layoutDirty = true;

    const recomputeCardLayoutMetrics = (): CardLayoutMetrics | null => {
      const seg = primarySegmentRef.current;
      if (!seg) return null;
      const tops: number[] = [];
      const heights: number[] = [];
      let acc = 0;
      for (const child of seg.children) {
        if (!(child instanceof HTMLElement)) continue;
        if (child.classList.contains(siteStyles.marqueeDimLayer)) continue;
        tops.push(acc);
        const h = child.offsetHeight;
        heights.push(h);
        acc += h;
      }
      if (heights.length === 0) return null;
      return { tops, heights, segmentHeight: acc };
    };

    const stopAutoSlide = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (measureFrameRef.current !== null) {
        cancelAnimationFrame(measureFrameRef.current);
        measureFrameRef.current = null;
      }
      lastFrameTimeRef.current = null;
      scrollPixelCarryRef.current = 0;
    };

    const scheduleResume = () => {
      if (selectedItemId !== null) return;
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
      }
      pausedByUserRef.current = true;
      stopAutoSlide();
      resumeTimerRef.current = window.setTimeout(() => {
        if (selectedItemId !== null) return;
        pausedByUserRef.current = false;
        startAutoSlide();
      }, restartAfterUserInputMs);
    };

    const onUserInput = () => {
      scheduleResume();
    };

    const onScroll = () => {
      if (performance.now() <= programmaticScrollUntilMsRef.current) return;
      scheduleResume();
    };

    const scheduleMeasureRetry = () => {
      if (measureFrameRef.current !== null) return;
      let tries = 3;
      const tick = () => {
        measureFrameRef.current = null;
        if (readSegmentHeight() > 0) {
          layoutDirty = true;
          return;
        }
        if (tries <= 0) return;
        tries -= 1;
        measureFrameRef.current = requestAnimationFrame(tick);
      };
      measureFrameRef.current = requestAnimationFrame(tick);
    };

    const step = (frameTime: number) => {
      const node = viewportRef.current;
      if (!node || pausedByUserRef.current || selectedItemId !== null) {
        stopAutoSlide();
        return;
      }
      const segmentHeight = readSegmentHeight();
      const maxScrollTop = node.scrollHeight - node.clientHeight;
      if (maxScrollTop <= 0) {
        if (segmentHeight <= 0) scheduleMeasureRetry();
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      const prevTime = lastFrameTimeRef.current ?? frameTime;
      const dtSec = Math.max(0, (frameTime - prevTime) / 1000);
      lastFrameTimeRef.current = frameTime;

      if (layoutDirty || cardLayoutMetrics === null) {
        cardLayoutMetrics = recomputeCardLayoutMetrics();
        layoutDirty = false;
      }

      const firstStart = primarySegmentRef.current?.offsetTop ?? 0;
      let pxPerSec = fallbackPxPerSec;
      if (cardLayoutMetrics && cardLayoutMetrics.segmentHeight > 0) {
        const localY = Math.min(
          Math.max(0, node.scrollTop - firstStart),
          Math.max(0, cardLayoutMetrics.segmentHeight - Number.EPSILON),
        );
        let idx = cardLayoutMetrics.heights.length - 1;
        for (let i = 0; i < cardLayoutMetrics.heights.length; i += 1) {
          const top = cardLayoutMetrics.tops[i]!;
          const hi = cardLayoutMetrics.heights[i]!;
          if (localY < top + hi) {
            idx = i;
            break;
          }
        }
        const hCur = cardLayoutMetrics.heights[idx] ?? 0;
        if (hCur > 0) {
          pxPerSec = hCur / durationSec;
        }
      }
      if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) {
        pxPerSec = fallbackPxPerSec;
      }
      const secondStart = secondarySegmentRef.current?.offsetTop ?? 0;
      const hasOffsetLoopWindow = secondStart > firstStart;
      const loopDistance = hasOffsetLoopWindow
        ? secondStart - firstStart
        : segmentHeight > 0
          ? segmentHeight
          : Math.max(maxScrollTop, 1);
      const loopEnd = hasOffsetLoopWindow ? secondStart : loopDistance;
      const deltaTotal = pxPerSec * dtSec + scrollPixelCarryRef.current;
      const deltaWhole = Math.floor(deltaTotal);
      scrollPixelCarryRef.current = deltaTotal - deltaWhole;
      let nextScrollTop = node.scrollTop + deltaWhole;
      while (nextScrollTop >= loopEnd && loopDistance > 0) {
        nextScrollTop -= loopDistance;
      }

      // programmatic scrollTop 변경 직후 발생하는 scroll 이벤트를 사용자 입력으로 오인하지 않도록 보호
      programmaticScrollUntilMsRef.current = performance.now() + 160;
      node.scrollTop = Math.round(Math.min(nextScrollTop, maxScrollTop));

      rafRef.current = requestAnimationFrame(step);
    };

    const startAutoSlide = () => {
      if (pausedByUserRef.current) return;
      if (selectedItemId !== null) return;
      if (rafRef.current !== null) return;
      lastFrameTimeRef.current = null;
      scrollPixelCarryRef.current = 0;
      rafRef.current = requestAnimationFrame(step);
    };

    viewport.addEventListener("touchstart", onUserInput, { passive: true });
    viewport.addEventListener("touchmove", onUserInput, { passive: true });
    viewport.addEventListener("wheel", onUserInput, { passive: true });
    viewport.addEventListener("pointerdown", onUserInput, { passive: true });
    viewport.addEventListener("scroll", onScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        layoutDirty = true;
        if (readSegmentHeight() <= 0) scheduleMeasureRetry();
      });
      if (primarySegmentRef.current) resizeObserver.observe(primarySegmentRef.current);
      resizeObserver.observe(viewport);
    }

    if (selectedItemId !== null) {
      pausedByUserRef.current = true;
      stopAutoSlide();
    } else {
      pausedByUserRef.current = false;
      if (readSegmentHeight() <= 0) scheduleMeasureRetry();
      startAutoSlide();
    }

    return () => {
      viewport.removeEventListener("touchstart", onUserInput);
      viewport.removeEventListener("touchmove", onUserInput);
      viewport.removeEventListener("wheel", onUserInput);
      viewport.removeEventListener("pointerdown", onUserInput);
      viewport.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
      stopAutoSlide();
      if (resumeTimerRef.current !== null) {
        window.clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
      pausedByUserRef.current = false;
      programmaticScrollUntilMsRef.current = 0;
      scrollPixelCarryRef.current = 0;
    };
  }, [items, slideCardMoveDurationSec, selectedItemId]);

  if (items.length === 0) {
    return (
      <div className={styles.slideViewportSiteMain} data-no-root-swipe data-site-main-scroll-viewport="1">
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string, segmentRef?: Ref<HTMLDivElement>) => (
    <div
      className={`${styles.sampleMainMarqueeSegment} ${siteStyles.segmentNoShrink} ${siteStyles.segmentRelativeForDim}`}
      key={segmentKey}
      ref={segmentRef}
    >
      <div
        className={`${siteStyles.marqueeDimLayer} ${selectedItemId ? siteStyles.marqueeDimLayerVisible : ""}`}
        aria-hidden
      />
      {items.map((item, itemIndex) => {
        const rowKey = `${segmentKey}-${item.id}`;
        const lcpHeroImage =
          segmentKey === "a" && itemIndex === lcpHeroItemIndex && lcpHeroItemIndex >= 0;
        return (
          <div key={rowKey} className={siteStyles.marqueeCardSlotShell}>
            <MainSiteCardRow
              rowKey={rowKey}
              item={item}
              selected={selectedItemId === item.id}
              onCardPointerDown={onCardPointerDown}
              lcpHeroImage={lcpHeroImage}
            />
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      className={`${styles.slideViewportSiteMain} ${siteStyles.viewportMarquee} ${siteStyles.viewportMarqueeLeadIn}`}
      data-no-root-swipe
      data-site-main-scroll-viewport="1"
      ref={viewportRef}
      onPointerDownCapture={onViewportPointerDownCapture}
    >
      <div className={`${styles.sampleMainMarqueeTrack} ${siteStyles.trackScrollStatic}`}>
        {renderSegment("a", primarySegmentRef)}
        {renderSegment("b", secondarySegmentRef)}
      </div>
    </div>
  );
}
