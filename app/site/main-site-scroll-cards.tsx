"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent, Ref } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/** 메인 이탈 후 복귀 시 세로 스크롤 위치 복원 — 새 세션·덱 변경 시 무시 */
const MAIN_SITE_SCROLL_STORAGE_KEY = "site-main-marquee-scroll-v1";

type MainSiteScrollStoredV1 = {
  v: 1;
  idsKey: string;
  scrollTop: number;
};

function mainScrollIdsKey(items: MainSiteScrollCardItem[]): string {
  return items.map((i) => i.id).join("\u001f");
}

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

function cardSlotClassNames(base: string, selected: boolean, selectedMod?: string): string {
  return [base, selected && selectedMod, selected && "card-selected"].filter(Boolean).join(" ");
}

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

  const isAdRow = isMainSiteScrollAdRow(item);

  if (item.slideDeckItem) {
    const sd = item.slideDeckItem;
    const deckInner = (
      <TournamentSnapshotCardView
        item={sd}
        slideDeck
        slideDeckAspectFill
        templateCardLayout
        editorCompactCardHeight
        suppressLink
        repImageHighPriority={lcpHeroImage}
        slideDeckSolidBackdrop={SLIDE_DECK_SOLID_BACKDROPS[0]}
      />
    );
    return (
      <div
        className={cardSlotClassNames(styles.sampleMainCardSlot, selected, styles.sampleMainCardSlotSelected)}
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
                <div className={siteStyles.mainScrollDeckCardShell}>
                  <div
                    className={`${editorCardStyles.previewCardWrap} ${editorCardStyles.previewCardWrapV2Chrome} ${editorCardStyles.previewCardWrapMainScrollFlex}${selected ? ` ${editorCardStyles.previewCardWrapMainScrollSelection}` : ""}`}
                  >
                    <div
                      className={`${editorCardStyles.cardPublishCaptureRoot} ${editorCardStyles.cardPublishCaptureRootMainScrollFlex}`}
                    >
                      {deckInner}
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
        className={cardSlotClassNames(styles.sampleMainCardSlot, selected, styles.sampleMainCardSlotSelected)}
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
      className={cardSlotClassNames(styles.sampleMainCardSlot, selected, styles.sampleMainCardSlotSelected)}
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
              {!isAdRow && item.scrollFaceBadge?.trim() ? (
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
            {isAdRow ? (
              <span className={siteStyles.publishedScrollAdMark} aria-hidden>
                AD
              </span>
            ) : null}
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
  /** `MainSlideAdConfig.cardMoveDurationSec` — 저장 키는 레거시 이름, 값은 1~10 속도 단계(서버에서 정규화). */
  slideCardMoveSpeedLevel: number;
};

export function MainSiteScrollCards({ items, slideCardMoveSpeedLevel }: MainSiteScrollCardsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const primarySegmentRef = useRef<HTMLDivElement | null>(null);
  const secondarySegmentRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<number | null>(null);
  const measureFrameRef = useRef<number | null>(null);
  const pausedByUserRef = useRef(false);
  const programmaticScrollUntilMsRef = useRef(0);
  /** `pxPerSec * dt` + carry; 매 프레임 `deltaTotal % 1`을 다음 carry로 유지 */
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

  const itemsIdsKey = items.length > 0 ? mainScrollIdsKey(items) : "";

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (items.length === 0 || !itemsIdsKey) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    let parsed: MainSiteScrollStoredV1 | null = null;
    try {
      const raw = sessionStorage.getItem(MAIN_SITE_SCROLL_STORAGE_KEY);
      if (raw) {
        const o = JSON.parse(raw) as Partial<MainSiteScrollStoredV1>;
        if (o?.v === 1 && typeof o.idsKey === "string" && typeof o.scrollTop === "number") {
          parsed = { v: 1, idsKey: o.idsKey, scrollTop: o.scrollTop };
        }
      }
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.idsKey !== itemsIdsKey) return;

    const target = parsed.scrollTop;
    const apply = () => {
      const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const nextTop = Math.min(Math.max(0, target), maxScroll);
      viewport.scrollTop = nextTop;
      programmaticScrollUntilMsRef.current = performance.now() + 250;
    };
    apply();
    requestAnimationFrame(apply);
  }, [items.length, itemsIdsKey]);

  const onCardPointerDown = useCallback((itemId: string) => {
    setSelectedItemId((prev) => {
      if (prev === null) return itemId;
      if (prev === itemId) return null;
      return null;
    });
  }, []);

  useEffect(() => {
    if (selectedItemId === null) return;
    const onDocPointerDownCapture = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest(`[${SITE_SCROLL_CARD}]`)) return;
      if (el.closest(`[${SITE_SCROLL_SHORTCUT}]`)) return;
      setSelectedItemId(null);
    };
    document.addEventListener("pointerdown", onDocPointerDownCapture, true);
    return () => document.removeEventListener("pointerdown", onDocPointerDownCapture, true);
  }, [selectedItemId]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (items.length === 0) return;

    const speedLevel = Number.isFinite(slideCardMoveSpeedLevel)
      ? Math.min(10, Math.max(1, Math.round(slideCardMoveSpeedLevel)))
      : 5;
    /** 5단계에서 뷰포트 한 높이 정도 이동 체감 ≈ 8~10초가 되도록 잡는 기준(초) */
    const baseTravelSec = 9;
    const fallbackPxPerSec = 24;
    const restartAfterUserInputMs = 2000;
    const readSegmentHeight = () => {
      const start = primarySegmentRef.current;
      if (!start) return 0;
      let total = 0;
      let el: Element | null = start;
      for (let i = 0; i < items.length && el; i++) {
        if (!(el instanceof HTMLElement)) break;
        total += el.offsetHeight;
        el = el.nextElementSibling;
      }
      return Number.isFinite(total) && total > 0 ? total : 0;
    };

    const isMainScrollDevDiag = process.env.NODE_ENV === "development";
    let devDiagLastLogMs = 0;
    let devDiagLastPxPerSec = -1;

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

      const firstStart = primarySegmentRef.current?.offsetTop ?? 0;
      const clientH = node.clientHeight;
      let pxPerSec = fallbackPxPerSec;
      let speedSource: "viewport" | "fallback" = "fallback";
      if (clientH > 0) {
        pxPerSec = (clientH * speedLevel) / (baseTravelSec * 5);
        speedSource = "viewport";
      }
      if (!Number.isFinite(pxPerSec) || pxPerSec <= 0) {
        pxPerSec = fallbackPxPerSec;
        speedSource = "fallback";
      }
      const secondStart = secondarySegmentRef.current?.offsetTop ?? 0;
      const hasOffsetLoopWindow = secondStart > firstStart;
      const loopDistance = hasOffsetLoopWindow
        ? secondStart - firstStart
        : segmentHeight > 0
          ? segmentHeight
          : Math.max(maxScrollTop, 1);
      const loopEnd = hasOffsetLoopWindow ? secondStart : loopDistance;
      const carryBefore = scrollPixelCarryRef.current;
      const deltaTotal = pxPerSec * dtSec + carryBefore;
      scrollPixelCarryRef.current = deltaTotal % 1;
      let nextScrollTop = node.scrollTop + deltaTotal;
      while (nextScrollTop >= loopEnd && loopDistance > 0) {
        nextScrollTop -= loopDistance;
      }

      const scrollTopBefore = node.scrollTop;
      const appliedScrollTop = Math.min(nextScrollTop, maxScrollTop);
      // programmatic scrollTop 변경 직후 발생하는 scroll 이벤트를 사용자 입력으로 오인하지 않도록 보호
      programmaticScrollUntilMsRef.current = performance.now() + 160;
      node.scrollTop = appliedScrollTop;
      const scrollTopReadBack = node.scrollTop;

      if (isMainScrollDevDiag) {
        const nowMs = performance.now();
        const scrollMismatch = Math.abs(scrollTopReadBack - appliedScrollTop) > 1;
        const pxJumped =
          devDiagLastPxPerSec > 0 && Math.abs(pxPerSec - devDiagLastPxPerSec) > devDiagLastPxPerSec * 0.2;
        const routineDue = nowMs - devDiagLastLogMs >= 1000;
        const bumpDue = scrollMismatch || pxJumped;
        if (routineDue || (bumpDue && nowMs - devDiagLastLogMs >= 250)) {
          devDiagLastLogMs = nowMs;
          devDiagLastPxPerSec = pxPerSec;
          console.info("[main-scroll-diag]", {
            speedLevel,
            baseTravelSec,
            clientH,
            pxPerSec,
            speedSource,
            usingFallback24: speedSource === "fallback",
            dtSec,
            deltaTotal,
            carryBefore,
            carryAfter: scrollPixelCarryRef.current,
            scrollTopBefore,
            appliedScrollTop,
            scrollTopReadBack,
            scrollMismatch,
            segmentHeight,
            maxScrollTop,
          });
        }
      }

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
        if (readSegmentHeight() <= 0) scheduleMeasureRetry();
      });
      if (trackRef.current) resizeObserver.observe(trackRef.current);
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
      try {
        const node = viewportRef.current;
        if (node && items.length > 0) {
          const payload: MainSiteScrollStoredV1 = {
            v: 1,
            idsKey: mainScrollIdsKey(items),
            scrollTop: node.scrollTop,
          };
          sessionStorage.setItem(MAIN_SITE_SCROLL_STORAGE_KEY, JSON.stringify(payload));
        }
      } catch {
        /* 저장 공간 부족 등 */
      }
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
  }, [items, slideCardMoveSpeedLevel, selectedItemId]);

  if (items.length === 0) {
    return (
      <div className={styles.slideViewportSiteMain} data-no-root-swipe data-site-main-scroll-viewport="1">
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string, segmentRootRef?: Ref<HTMLDivElement>) => (
    <div
      className={`${styles.sampleMainMarqueeSegment} ${siteStyles.segmentMarqueeContents}`}
      key={segmentKey}
    >
      {items.map((item, itemIndex) => {
        const rowKey = `${segmentKey}-${item.id}`;
        const lcpHeroImage =
          segmentKey === "a" && itemIndex === lcpHeroItemIndex && lcpHeroItemIndex >= 0;
        return (
          <div
            key={rowKey}
            className={siteStyles.marqueeCardSlotShell}
            ref={itemIndex === 0 ? segmentRootRef : undefined}
          >
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
    >
      <div
        ref={trackRef}
        className={`${styles.sampleMainMarqueeTrack} ${siteStyles.trackScrollStatic}`}
      >
        {renderSegment("a", primarySegmentRef)}
        {renderSegment("b", secondarySegmentRef)}
        {selectedItemId !== null ? (
          <div className={siteStyles.trackDimOverlay} aria-hidden />
        ) : null}
      </div>
    </div>
  );
}
