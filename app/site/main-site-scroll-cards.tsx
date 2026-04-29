"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./main-sample/main-sample.module.css";
import siteStyles from "./main-site-scroll-cards.module.css";

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
};

type CardRowProps = {
  rowKey: string;
  item: MainSiteScrollCardItem;
  selected: boolean;
  onCardPointerDown: (itemId: string) => void;
};

const MainSiteCardRow = memo(function MainSiteCardRow({
  rowKey,
  item,
  selected,
  onCardPointerDown,
}: CardRowProps) {
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(`[${SITE_SCROLL_SHORTCUT}]`)) return;
      onCardPointerDown(item.id);
    },
    [item.id, onCardPointerDown],
  );

  const faceStyle: CSSProperties = {};
  if (!item.imageUrl?.trim() && item.faceCssBackground?.trim()) {
    faceStyle.background = item.faceCssBackground.trim();
  } else if (!item.imageUrl?.trim()) {
    faceStyle.background = "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)";
  }

  return (
    <div
      className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
      {...{ [SITE_SCROLL_CARD]: "" }}
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
        className={`${styles.sampleMainCardFace} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
        style={faceStyle}
      >
        {item.imageUrl?.trim() ? (
          <img
            src={item.imageUrl.trim()}
            alt=""
            className={styles.sampleMainCardPoster}
            decoding="async"
          />
        ) : null}
        <div className={styles.sampleMainCardTitleOverlay}>{item.title}</div>
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

const MARQUEE_RESUME_AFTER_MS = 1000;

export function MainSiteScrollCards({ items, slideCardMoveDurationSec }: MainSiteScrollCardsProps) {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [marqueePausedByUser, setMarqueePausedByUser] = useState(false);
  const marqueeUserPauseRef = useRef(false);
  const marqueeResumeTimerRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const bumpMarqueeUserPause = useCallback(() => {
    if (!marqueeUserPauseRef.current) {
      marqueeUserPauseRef.current = true;
      setMarqueePausedByUser(true);
    }
    if (marqueeResumeTimerRef.current != null) {
      window.clearTimeout(marqueeResumeTimerRef.current);
    }
    marqueeResumeTimerRef.current = window.setTimeout(() => {
      marqueeUserPauseRef.current = false;
      setMarqueePausedByUser(false);
      marqueeResumeTimerRef.current = null;
    }, MARQUEE_RESUME_AFTER_MS);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || items.length === 0) return;

    const onScroll = () => {
      bumpMarqueeUserPause();
    };
    const onWheel = () => {
      bumpMarqueeUserPause();
    };
    const onTouchMove = () => {
      bumpMarqueeUserPause();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchmove", onTouchMove);
      if (marqueeResumeTimerRef.current != null) {
        window.clearTimeout(marqueeResumeTimerRef.current);
        marqueeResumeTimerRef.current = null;
      }
      marqueeUserPauseRef.current = false;
      setMarqueePausedByUser(false);
    };
  }, [items.length, bumpMarqueeUserPause]);

  const trackStyle = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${slideCardMoveDurationSec}s`,
        animationPlayState: "running" as const,
      }) as CSSProperties,
    [slideCardMoveDurationSec],
  );

  const trackStylePaused = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${slideCardMoveDurationSec}s`,
        animationPlayState: "paused" as const,
      }) as CSSProperties,
    [slideCardMoveDurationSec],
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

  if (items.length === 0) {
    return (
      <div className={styles.slideViewportSiteMain} data-no-root-swipe>
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string) => (
    <div
      className={`${styles.sampleMainMarqueeSegment} ${siteStyles.segmentNoShrink} ${siteStyles.segmentRelativeForDim}`}
      key={segmentKey}
    >
      <div
        className={`${siteStyles.marqueeDimLayer} ${selectedItemId ? siteStyles.marqueeDimLayerVisible : ""}`}
        aria-hidden
      />
      <div className={siteStyles.leadInSpacer} aria-hidden />
      {items.map((item) => {
        const rowKey = `${segmentKey}-${item.id}`;
        return (
          <MainSiteCardRow
            key={rowKey}
            rowKey={rowKey}
            item={item}
            selected={selectedItemId === item.id}
            onCardPointerDown={onCardPointerDown}
          />
        );
      })}
    </div>
  );

  const pauseMarquee = selectedItemId !== null || marqueePausedByUser;

  return (
    <div
      ref={viewportRef}
      className={`${styles.slideViewportSiteMain} ${siteStyles.viewportMarquee}`}
      data-no-root-swipe
      onPointerDownCapture={onViewportPointerDownCapture}
    >
      <div
        className={`${styles.sampleMainMarqueeTrack} ${siteStyles.trackWillChange}`}
        style={pauseMarquee ? trackStylePaused : trackStyle}
      >
        {renderSegment("a")}
        {renderSegment("b")}
      </div>
    </div>
  );
}
