"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import styles from "./main-sample.module.css";

const SAMPLE_MAIN_CARD = "data-sample-main-card";
const SAMPLE_MAIN_SHORTCUT = "data-sample-main-shortcut";

/** 스냅샷(완성 데이터) — 렌더 시 계산 없음 */
const SNAPSHOT = [
  { id: "0", bg: "#c0392b", href: "/site" },
  { id: "1", bg: "#d35400", href: "/site" },
  { id: "2", bg: "#f39c12", href: "/site" },
  { id: "3", bg: "#16a085", href: "/site" },
  { id: "4", bg: "#2980b9", href: "/site" },
  { id: "5", bg: "#8e44ad", href: "/site" },
] as const;

type SnapshotItem = (typeof SNAPSHOT)[number];

type CardRowProps = {
  rowKey: string;
  item: SnapshotItem;
  selected: boolean;
  onCardPointerDown: (rowKey: string) => void;
};

export type MainSampleScrollCardsProps = {
  /** `MainSlideAdConfig.cardMoveDurationSec` — 1~10 속도 단계(레거시 JSON 키명) */
  slideCardMoveSpeedLevel: number;
};

const MainSampleCardRow = memo(function MainSampleCardRow({
  rowKey,
  item,
  selected,
  onCardPointerDown,
}: CardRowProps) {
  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(`[${SAMPLE_MAIN_SHORTCUT}]`)) return;
      onCardPointerDown(rowKey);
    },
    [rowKey, onCardPointerDown],
  );

  return (
    <div
      className={`${styles.sampleMainCardSlot} ${selected ? styles.sampleMainCardSlotSelected : ""}`}
      {...{ [SAMPLE_MAIN_CARD]: "" }}
      style={{ touchAction: "manipulation" }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`샘플 카드 ${rowKey}${selected ? ", 선택됨" : ""}`}
      onPointerDown={onPointerDown}
      onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        onCardPointerDown(rowKey);
      }}
    >
      <div
        className={`${styles.sampleMainCardFace} ${selected ? styles.sampleMainCardFaceSelected : ""}`}
        style={{ backgroundColor: item.bg }}
      >
        <a
          href={item.href}
          className={styles.sampleMainCardShortcut}
          {...{ [SAMPLE_MAIN_SHORTCUT]: "" }}
          tabIndex={selected ? 0 : -1}
          aria-hidden={!selected}
          onPointerDown={(e) => e.stopPropagation()}
        >
          자세히 보기 ▶
        </a>
      </div>
    </div>
  );
});

export function MainSampleScrollCards({ slideCardMoveSpeedLevel }: MainSampleScrollCardsProps) {
  /** 무한 트랙 구간(a|b) + 스냅샷 id — 동일 스냅샷 행이 두 세그먼트에 있어 행 단위로만 선택 */
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  const level = Number.isFinite(slideCardMoveSpeedLevel)
    ? Math.min(10, Math.max(1, Math.round(slideCardMoveSpeedLevel)))
    : 5;
  /** 메인과 동일 기준: 5단계 ≈ 9초·뷰포트 높이 상당 이동에 맞춘 샘플 애니메이션 길이(초) */
  const sampleAnimSec = (9 * 5) / level;

  const trackStyle = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${sampleAnimSec}s`,
        animationPlayState: "running" as const,
      }) as CSSProperties,
    [sampleAnimSec],
  );

  const trackStylePaused = useMemo(
    () =>
      ({
        "--main-sample-slide-duration": `${sampleAnimSec}s`,
        animationPlayState: "paused" as const,
      }) as CSSProperties,
    [sampleAnimSec],
  );

  const onCardPointerDown = useCallback((rowKey: string) => {
    setSelectedRowKey((prev) => {
      if (prev === null) return rowKey;
      if (prev === rowKey) return null;
      return null;
    });
  }, []);

  const onViewportPointerDownCapture = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (selectedRowKey === null) return;
    const el = e.target as HTMLElement | null;
    if (!el || el.closest(`[${SAMPLE_MAIN_CARD}]`)) return;
    setSelectedRowKey(null);
  }, [selectedRowKey]);

  const renderSegment = (segmentKey: string) => (
    <div className={styles.sampleMainMarqueeSegment} key={segmentKey}>
      {SNAPSHOT.map((item) => {
        const rowKey = `${segmentKey}-${item.id}`;
        return (
          <MainSampleCardRow
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
