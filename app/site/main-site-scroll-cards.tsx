"use client";

import Link from "next/link";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import styles from "./main-sample/main-sample.module.css";

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
  onCardPointerDown: (rowKey: string) => void;
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
      onCardPointerDown(rowKey);
    },
    [rowKey, onCardPointerDown],
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
      style={{ touchAction: "manipulation" }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${item.title}${selected ? ", 선택됨" : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onCardPointerDown(rowKey);
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

export function MainSiteScrollCards({ items, slideCardMoveDurationSec }: MainSiteScrollCardsProps) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

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

  const onCardPointerDown = useCallback((rowKey: string) => {
    setSelectedRowKey((prev) => {
      if (prev === null) return rowKey;
      if (prev === rowKey) return null;
      return null;
    });
  }, []);

  const onViewportPointerDownCapture = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (selectedRowKey === null) return;
      const el = e.target as HTMLElement | null;
      if (!el || el.closest(`[${SITE_SCROLL_CARD}]`)) return;
      setSelectedRowKey(null);
    },
    [selectedRowKey],
  );

  if (items.length === 0) {
    return (
      <div className={styles.slideViewport} data-no-root-swipe>
        <p className={styles.sampleMainEmpty}>등록된 메인 카드가 없습니다.</p>
      </div>
    );
  }

  const renderSegment = (segmentKey: string) => (
    <div className={styles.sampleMainMarqueeSegment} key={segmentKey}>
      {items.map((item) => {
        const rowKey = `${segmentKey}-${item.id}`;
        return (
          <MainSiteCardRow
            key={rowKey}
            rowKey={rowKey}
            item={item}
            selected={selectedRowKey === rowKey}
            onCardPointerDown={onCardPointerDown}
          />
        );
      })}
    </div>
  );

  return (
    <div className={styles.slideViewport} data-no-root-swipe onPointerDownCapture={onViewportPointerDownCapture}>
      <div
        className={styles.sampleMainMarqueeTrack}
        style={selectedRowKey !== null ? trackStylePaused : trackStyle}
      >
        {renderSegment("a")}
        {renderSegment("b")}
      </div>
    </div>
  );
}
