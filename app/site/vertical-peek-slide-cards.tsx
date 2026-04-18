"use client";

import { useEffect, useMemo, useRef } from "react";
import PublishedSnapshotCard from "./published-snapshot-card";

type BlockAlignment = "LEFT" | "CENTER" | "RIGHT";

type VerticalPeekSlideItem = {
  snapshotId: string;
  title: string;
  subtitle: string;
  publishedAt: string;
  targetDetailUrl: string;
  image320Url?: string;
  templateType?: "tournament" | "venue";
  statusBadge?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
};

type Props = {
  blockId: string;
  alignment: BlockAlignment;
  layout?: "vertical" | "horizontal";
  peekRatio?: number;
  autoPlay?: boolean;
  pauseOnHover?: boolean;
  items: VerticalPeekSlideItem[];
};

/** 읽기 가능한 매우 느린 상향 스크롤 (px/s) */
const AUTO_SCROLL_PX_PER_SEC = 12;
const REDUCED_MOTION_SCROLL_PX_PER_SEC = 4;

const DRAG_THRESHOLD_PX = 10;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number): number {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

export default function VerticalPeekSlideCards({
  blockId,
  alignment,
  layout,
  peekRatio: _peekRatio,
  autoPlay = true,
  pauseOnHover = true,
  items,
}: Props) {
  void _peekRatio;

  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const rowWrapperRefs = useRef<(HTMLDivElement | null)[]>([]);

  const offsetRef = useRef(0);
  const lastFrameTsRef = useRef<number | null>(null);
  const pausedRef = useRef(false);
  const hoverRef = useRef(false);
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const dragStartClientYRef = useRef(0);
  const dragStartOffsetRef = useRef(0);
  const wheelPauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rowHeightRef = useRef(96);
  const containerHeightRef = useRef(288);
  const itemsLenRef = useRef(0);
  const autoSpeedRef = useRef(AUTO_SCROLL_PX_PER_SEC);
  const reducedMotionRef = useRef(false);

  const doubled = useMemo(() => {
    if (items.length === 0) return [];
    return [...items, ...items];
  }, [items]);

  const itemsKey = useMemo(() => items.map((i) => i.snapshotId).join("|"), [items]);

  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items.length]);

  useEffect(() => {
    offsetRef.current = 0;
  }, [itemsKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height ?? 0;
      if (h > 0) {
        containerHeightRef.current = h;
        rowHeightRef.current = h / 3;
      }
    });
    ro.observe(el);
    const h0 = el.getBoundingClientRect().height;
    if (h0 > 0) {
      containerHeightRef.current = h0;
      rowHeightRef.current = h0 / 3;
    }
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      reducedMotionRef.current = mq.matches;
      // 접근성 설정이 켜져도 완전 정지 대신 아주 느린 자동 이동을 유지한다.
      autoSpeedRef.current = mq.matches ? REDUCED_MOTION_SCROLL_PX_PER_SEC : AUTO_SCROLL_PX_PER_SEC;
    };
    apply();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    }
    mq.addListener(apply);
    return () => mq.removeListener(apply);
  }, []);

  useEffect(() => {
    if (items.length === 0 || doubled.length === 0) return;

    let rafId = 0;

    function applyRowStyles(offset: number, R: number, H: number) {
      const children = rowWrapperRefs.current;
      const n = children.length;
      for (let i = 0; i < n; i++) {
        const el = children[i];
        if (!el) continue;
        const centerY = i * R - offset + R / 2;
        const dist = Math.abs(centerY - H / 2);
        const t = Math.max(0, Math.min(1, 1 - dist / (R * 0.62)));
        const scale = 0.96 + 0.04 * t;
        const opacity = 0.9 + 0.1 * t;
        el.style.transform = `scale(${scale})`;
        el.style.opacity = String(opacity);
      }
    }

    function frame(now: number) {
      if (lastFrameTsRef.current === null) lastFrameTsRef.current = now;
      const dt = Math.min(0.05, (now - lastFrameTsRef.current) / 1000);
      lastFrameTsRef.current = now;

      const len = itemsLenRef.current;
      const R = rowHeightRef.current;
      const H = containerHeightRef.current;
      const loop = len * R;
      const phase = ((offsetRef.current % R) + R) % R;
      const distanceFromCenter = Math.min(phase, R - phase);
      const slowZonePx = Math.max(10, R * 0.1);
      const speedFactor = 0.3 + 0.7 * easeOutCubic(distanceFromCenter / slowZonePx);

      if (loop > 0 && autoPlay && !pausedRef.current && !draggingRef.current && autoSpeedRef.current > 0) {
        offsetRef.current += autoSpeedRef.current * speedFactor * dt;
        while (offsetRef.current >= loop) offsetRef.current -= loop;
      }

      const offset = offsetRef.current;
      const track = trackRef.current;
      if (track) {
        track.style.transform = `translate3d(0,${-offset}px,0)`;
      }
      applyRowStyles(offset, R, H);

      rafId = requestAnimationFrame(frame);
    }

    rafId = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(rafId);
      lastFrameTsRef.current = null;
    };
  }, [doubled.length, items.length, itemsKey, autoPlay]);

  useEffect(() => {
    return () => {
      if (wheelPauseTimerRef.current) clearTimeout(wheelPauseTimerRef.current);
    };
  }, []);

  if (items.length === 0) return null;

  function scheduleWheelResume() {
    if (wheelPauseTimerRef.current) clearTimeout(wheelPauseTimerRef.current);
    wheelPauseTimerRef.current = setTimeout(() => {
      wheelPauseTimerRef.current = null;
      if (!hoverRef.current && !draggingRef.current) pausedRef.current = false;
    }, 1800);
  }

  function handleWheel(e: React.WheelEvent) {
    const len = itemsLenRef.current;
    const R = rowHeightRef.current;
    const loop = len * R;
    if (loop <= 0) return;
    pausedRef.current = true;
    let next = offsetRef.current + e.deltaY * 0.45;
    next = ((next % loop) + loop) % loop;
    offsetRef.current = next;
    scheduleWheelResume();
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    dragMovedRef.current = false;
    draggingRef.current = true;
    pausedRef.current = true;
    dragStartClientYRef.current = e.clientY;
    dragStartOffsetRef.current = offsetRef.current;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dy = e.clientY - dragStartClientYRef.current;
    if (Math.abs(dy) > DRAG_THRESHOLD_PX) {
      dragMovedRef.current = true;
    }
    const len = itemsLenRef.current;
    const R = rowHeightRef.current;
    const loop = len * R;
    if (loop <= 0) return;
    let next = dragStartOffsetRef.current - dy;
    next = ((next % loop) + loop) % loop;
    offsetRef.current = next;
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (dragMovedRef.current) {
      e.preventDefault();
    }
    if (!hoverRef.current) pausedRef.current = false;
  }

  function handleClickCapture(e: React.MouseEvent) {
    if (dragMovedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      dragMovedRef.current = false;
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        overflow: "hidden",
        height: "18rem",
        position: "relative",
        padding: "0 0.15rem",
        touchAction: "none",
      }}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
      onMouseEnter={() => {
        if (!pauseOnHover) return;
        hoverRef.current = true;
        if (autoPlay) {
          pausedRef.current = true;
        }
      }}
      onMouseLeave={() => {
        if (!pauseOnHover) return;
        hoverRef.current = false;
        if (autoPlay && !draggingRef.current) {
          pausedRef.current = false;
        }
      }}
    >
      <div
        ref={trackRef}
        style={{
          willChange: "transform",
        }}
      >
        {doubled.map((snapshot, index) => (
          <div
            key={`${blockId}-${snapshot.snapshotId}-${index}`}
            ref={(el) => {
              rowWrapperRefs.current[index] = el;
            }}
            style={{
              height: "calc(18rem / 3)",
              flexShrink: 0,
              display: "flex",
              alignItems: "stretch",
              boxSizing: "border-box",
              padding: "0.12rem 0",
              transform: "scale(0.96)",
              opacity: 0.9,
            }}
          >
            <PublishedSnapshotCard
              item={snapshot}
              alignment={alignment}
              layout={layout}
              templateType={snapshot.templateType}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
