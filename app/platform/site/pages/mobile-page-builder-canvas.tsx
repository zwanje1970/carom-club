"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { RefObject } from "react";

const SCALE_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const;
const DEFAULT_SCALE_INDEX = 0;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;
const PAN_MARGIN = 48;

export type PageBuilderViewportMode = "pc" | "mobile-portrait" | "mobile-landscape";

export function usePageBuilderViewportMode(): PageBuilderViewportMode {
  const [mode, setMode] = useState<PageBuilderViewportMode>("pc");

  useEffect(() => {
    function resolve(): PageBuilderViewportMode {
      if (typeof window === "undefined") return "pc";
      const w = window.innerWidth;
      const h = window.innerHeight;
      const narrow = w <= 1024;
      const coarse = window.matchMedia("(pointer: coarse)").matches;
      const touch = "ontouchstart" in window;
      const mobileLike = narrow && (coarse || touch);
      if (!mobileLike) return "pc";
      return h > w ? "mobile-portrait" : "mobile-landscape";
    }

    function update() {
      setMode(resolve());
    }

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return mode;
}

export type MobilePageBuilderCanvasHandle = {
  zoomOut: () => void;
  zoomIn: () => void;
  resetToDefaultScale: () => void;
  setScale100: () => void;
  getScale: () => number;
};

type TransformState = { x: number; y: number; scale: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampPan(
  x: number,
  y: number,
  scale: number,
  innerW: number,
  innerH: number,
  viewW: number,
  viewH: number
): { x: number; y: number } {
  const sw = innerW * scale;
  const sh = innerH * scale;
  const m = PAN_MARGIN;

  let minX: number;
  let maxX: number;
  if (sw <= viewW) {
    const cx = (viewW - sw) / 2;
    minX = maxX = cx;
  } else {
    minX = viewW - sw - m;
    maxX = m;
  }

  let minY: number;
  let maxY: number;
  if (sh <= viewH) {
    const cy = (viewH - sh) / 2;
    minY = maxY = cy;
  } else {
    minY = viewH - sh - m;
    maxY = m;
  }

  return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
}

export const MobilePageBuilderCanvas = forwardRef<
  MobilePageBuilderCanvasHandle,
  { children: ReactNode }
>(function MobilePageBuilderCanvas({ children }, ref) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<TransformState>({
    x: 0,
    y: 0,
    scale: SCALE_STEPS[DEFAULT_SCALE_INDEX],
  });
  const [, setTick] = useState(0);
  const innerSizeRef = useRef({ w: 800, h: 600 });
  const viewSizeRef = useRef({ w: 400, h: 300 });

  const applyTransform = useCallback((next: TransformState) => {
    transformRef.current = next;
    const el = innerRef.current;
    if (el) {
      el.style.transform = `translate(${next.x}px, ${next.y}px) scale(${next.scale})`;
    }
    setTick((t) => t + 1);
  }, []);

  const syncSizes = useCallback(() => {
    const vp = viewportRef.current;
    const inner = innerRef.current;
    if (!vp || !inner) return;
    viewSizeRef.current = { w: vp.clientWidth, h: vp.clientHeight };
    innerSizeRef.current = { w: inner.scrollWidth, h: inner.scrollHeight };
  }, []);

  const clampTransform = useCallback(
    (t: TransformState): TransformState => {
      syncSizes();
      const { w: vw, h: vh } = viewSizeRef.current;
      const { w: iw, h: ih } = innerSizeRef.current;
      const pan = clampPan(t.x, t.y, t.scale, iw, ih, vw, vh);
      return { ...t, x: pan.x, y: pan.y };
    },
    [syncSizes]
  );

  useEffect(() => {
    const vp = viewportRef.current;
    const inner = innerRef.current;
    if (!vp || !inner) return;

    const ro = new ResizeObserver(() => {
      syncSizes();
      applyTransform(clampTransform(transformRef.current));
    });
    ro.observe(vp);
    ro.observe(inner);
    syncSizes();
    applyTransform(clampTransform(transformRef.current));
    return () => ro.disconnect();
  }, [applyTransform, clampTransform, syncSizes]);

  const zoomOut = useCallback(() => {
    const cur = transformRef.current.scale;
    let nextStep: number = SCALE_STEPS[0];
    for (const s of SCALE_STEPS) {
      if (s < cur - 0.02) nextStep = s;
    }
    if (nextStep >= cur) {
      nextStep = clamp(cur - 0.25, MIN_SCALE, MAX_SCALE);
    }
    applyTransform(clampTransform({ ...transformRef.current, scale: nextStep }));
  }, [applyTransform, clampTransform]);

  const zoomIn = useCallback(() => {
    const cur = transformRef.current.scale;
    let nextStep: number = SCALE_STEPS[SCALE_STEPS.length - 1];
    for (let i = SCALE_STEPS.length - 1; i >= 0; i--) {
      if (SCALE_STEPS[i] > cur + 0.02) {
        nextStep = SCALE_STEPS[i];
        break;
      }
    }
    if (nextStep <= cur) {
      nextStep = clamp(cur + 0.25, MIN_SCALE, MAX_SCALE);
    }
    applyTransform(clampTransform({ ...transformRef.current, scale: nextStep }));
  }, [applyTransform, clampTransform]);

  const resetToDefaultScale = useCallback(() => {
    syncSizes();
    const scale = SCALE_STEPS[DEFAULT_SCALE_INDEX];
    const { w: vw, h: vh } = viewSizeRef.current;
    const { w: iw, h: ih } = innerSizeRef.current;
    const sw = iw * scale;
    const sh = ih * scale;
    const x = (vw - sw) / 2;
    const y = (vh - sh) / 2;
    applyTransform(clampTransform({ x, y, scale }));
  }, [applyTransform, clampTransform, syncSizes]);

  const setScale100 = useCallback(() => {
    syncSizes();
    const scale = 1;
    const { w: vw, h: vh } = viewSizeRef.current;
    const { w: iw, h: ih } = innerSizeRef.current;
    const sw = iw * scale;
    const sh = ih * scale;
    const x = (vw - sw) / 2;
    const y = (vh - sh) / 2;
    applyTransform(clampTransform({ x, y, scale }));
  }, [applyTransform, clampTransform, syncSizes]);

  useImperativeHandle(
    ref,
    () => ({
      zoomOut,
      zoomIn,
      resetToDefaultScale,
      setScale100,
      getScale: () => transformRef.current.scale,
    }),
    [zoomIn, zoomOut, resetToDefaultScale, setScale100]
  );

  const touchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    lastDistance: number;
    lastScale: number;
    lastTx: number;
    lastTy: number;
  } | null>(null);
  const panRef = useRef<{
    x: number;
    y: number;
    startTx: number;
    startTy: number;
    active: boolean;
  } | null>(null);

  function distance(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
  }

  function center(a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (!t) continue;
      touchesRef.current.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    if (e.touches.length >= 2) {
      const pts = [e.touches[0], e.touches[1]];
      const d0 = distance(pts[0], pts[1]);
      const cur = transformRef.current;
      pinchRef.current = {
        lastDistance: d0,
        lastScale: cur.scale,
        lastTx: cur.x,
        lastTy: cur.y,
      };
      panRef.current = null;
      return;
    }
    if (e.touches.length === 1 && !pinchRef.current) {
      const t = e.touches[0];
      const cur = transformRef.current;
      panRef.current = {
        x: t.clientX,
        y: t.clientY,
        startTx: cur.x,
        startTy: cur.y,
        active: false,
      };
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length >= 2 && pinchRef.current) {
        e.preventDefault();
        const pts = [e.touches[0], e.touches[1]];
        const d1 = distance(pts[0], pts[1]);
        const p = pinchRef.current;
        if (p.lastDistance < 1) return;
        let nextScale = clamp((p.lastScale * d1) / p.lastDistance, MIN_SCALE, MAX_SCALE);
        const c = center(pts[0], pts[1]);
        const vp = viewportRef.current;
        if (!vp) return;
        const rect = vp.getBoundingClientRect();
        const cx = c.x - rect.left;
        const cy = c.y - rect.top;
        const worldX = (cx - p.lastTx) / p.lastScale;
        const worldY = (cy - p.lastTy) / p.lastScale;
        const nextX = cx - worldX * nextScale;
        const nextY = cy - worldY * nextScale;
        pinchRef.current = {
          lastDistance: d1,
          lastScale: nextScale,
          lastTx: nextX,
          lastTy: nextY,
        };
        applyTransform(clampTransform({ x: nextX, y: nextY, scale: nextScale }));
        return;
      }
      if (e.touches.length === 1 && panRef.current && !pinchRef.current) {
        const t = e.touches[0];
        const p = panRef.current;
        const dx = t.clientX - p.x;
        const dy = t.clientY - p.y;
        const moved = Math.hypot(dx, dy);
        const PAN_THRESHOLD = 10;
        if (!p.active && moved < PAN_THRESHOLD) {
          return;
        }
        e.preventDefault();
        const next = { ...p, active: true };
        panRef.current = next;
        const cur = transformRef.current;
        applyTransform(
          clampTransform({
            x: p.startTx + dx,
            y: p.startTy + dy,
            scale: cur.scale,
          })
        );
      }
    },
    [applyTransform, clampTransform]
  );

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches.item(i);
      if (t) touchesRef.current.delete(t.identifier);
    }
    if (e.touches.length < 2) {
      pinchRef.current = null;
    }
    if (e.touches.length === 0) {
      panRef.current = null;
      pinchRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const cur = transformRef.current;
      panRef.current = {
        x: t.clientX,
        y: t.clientY,
        startTx: cur.x,
        startTy: cur.y,
        active: false,
      };
    }
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const preventWheel = (ev: WheelEvent) => {
      ev.preventDefault();
    };
    el.addEventListener("wheel", preventWheel, { passive: false });
    return () => el.removeEventListener("wheel", preventWheel);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resetToDefaultScale();
      });
    });
    return () => cancelAnimationFrame(id);
  }, [resetToDefaultScale]);

  return (
    <div
      ref={viewportRef}
      className="mobile-page-builder-canvas-viewport"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      style={{
        flex: 1,
        minHeight: 0,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
        overscrollBehavior: "none",
      }}
    >
      <div
        ref={innerRef}
        className="mobile-page-builder-canvas-inner"
        style={{
          transform: `translate(${transformRef.current.x}px, ${transformRef.current.y}px) scale(${transformRef.current.scale})`,
          transformOrigin: "0 0",
          width: "max-content",
          maxWidth: "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      <style jsx>{`
        .mobile-page-builder-canvas-inner :global(.platform-page-builder-workspace) {
          height: auto;
          min-height: 60vh;
          overflow: visible;
          align-items: start;
        }
        .mobile-page-builder-canvas-inner :global(.platform-page-builder-settings),
        .mobile-page-builder-canvas-inner :global(.platform-page-builder-structure),
        .mobile-page-builder-canvas-inner :global(.platform-page-builder-preview-panel) {
          overflow: visible !important;
          height: auto !important;
          max-height: none !important;
        }
      `}</style>
    </div>
  );
});

export function PageBuilderCanvasShell({
  enabled,
  canvasRef,
  children,
}: {
  enabled: boolean;
  canvasRef: RefObject<MobilePageBuilderCanvasHandle | null>;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: "100%" }}>
      <MobilePageBuilderCanvas ref={canvasRef}>{children}</MobilePageBuilderCanvas>
    </div>
  );
}
