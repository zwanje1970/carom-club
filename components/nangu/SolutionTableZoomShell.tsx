"use client";

import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  clampPanToCoverBounds,
  clampZoomLevel,
  computePanClampBoundsForCover,
  computeZoomTransform,
  type SolutionTableFitMode,
  SOLUTION_ZOOM_MAX,
  SOLUTION_ZOOM_MIN,
  SOLUTION_ZOOM_STEP,
  viewportPxToCanvasPx,
} from "@/lib/solution-table-zoom-math";
import {
  SolutionTableZoomProvider,
  type SolutionTableZoomContextValue,
} from "@/components/nangu/solution-table-zoom-context";

/** zoomLevel &gt; 1 일 때 빈 공간 드래그 패닝 + 탭은 onEmptyTap */
export type SolutionTablePanPointerPolicy = {
  /** target: 포인터 이벤트 타깃(캡처 단계). 오버레이 UI 등에서 패닝 제외용 */
  isEmptyForPan: (clientX: number, clientY: number, target?: EventTarget | null) => boolean;
  onEmptyTap?: (clientX: number, clientY: number) => void;
};

const EMPTY_PAN_MOVE_THRESHOLD_PX = 6;

/** 터치·스타일러스 위주 단말 — 핀치 줌·줌 UI 숨김 */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const apply = () => setCoarse(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return coarse;
}

/** 좌측 확대·축소 패널 토글 — 투명 배경 돋보기 */
function MagnifierToggleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M16.5 16.5L21 21" />
    </svg>
  );
}

const ZOOM_PANEL_IDLE_MS = 2800;

export type SolutionTableZoomShellApi = {
  zoomIn: () => void;
  zoomOut: () => void;
};

export interface SolutionTableZoomShellProps {
  contentWidth: number;
  contentHeight: number;
  focusCanvasX: number;
  focusCanvasY: number;
  interactionLocked?: boolean;
  className?: string;
  children: React.ReactNode | ((ctx: SolutionTableZoomContextValue) => React.ReactNode);
  /** 확대(zoomLevel&gt;1) 시 빈 영역만 드래그 패닝 (공/스팟/세그먼트는 false) */
  panPointerPolicy?: SolutionTablePanPointerPolicy;
  /** 외부(예: 상단 케밥)에서 +/− 줌과 동기화 */
  zoomApiRef?: React.MutableRefObject<SolutionTableZoomShellApi | null>;
  /** true면 재생 잠금 중에도 좌측 줌 컨트롤 표시 (난구 당구노트형 전체화면) */
  forceShowZoomControls?: boolean;
  /**
   * cover: 뷰포트를 콘텐츠가 항상 덮음(최소 줌도 꽉 찬 화면, 테이블 주변 여백 없음). 패닝은 잘리지 않는 범위로만 허용.
   * contain(기본): 전체 테이블이 보이도록 맞춤(비율에 따라 여백 가능).
   */
  fitMode?: SolutionTableFitMode;
  /**
   * 주입 시: 이 값이 바뀔 때만「초점 변경」으로 패닝 리셋(공 배치에서 공이 움직여도 리셋 안 함).
   * 미주입: focusCanvas 좌표 변화 시 리셋(경로 편집 등 기존 동작).
   */
  panResetKey?: string | number;
}

/**
 * 테이블 전체(캔버스+오버레이)에 scale + translate 적용.
 * ref → 뷰포트 DOM (좌표 변환·레이아웃용).
 */
export const SolutionTableZoomShell = forwardRef<HTMLDivElement, SolutionTableZoomShellProps>(
  function SolutionTableZoomShell(
    {
      contentWidth: W,
      contentHeight: H,
      focusCanvasX,
      focusCanvasY,
      interactionLocked = false,
      className = "",
      children,
      panPointerPolicy,
      zoomApiRef,
      forceShowZoomControls = false,
      fitMode = "contain",
      panResetKey,
    },
    ref
  ) {
    const viewportRef = useRef<HTMLDivElement | null>(null) as React.MutableRefObject<HTMLDivElement | null>;
    const setViewportRef = useCallback(
      (node: HTMLDivElement | null) => {
        viewportRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref && "current" in ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref]
    );

    const [vw, setVw] = useState(0);
    const [vh, setVh] = useState(0);
    const [zoomLevel, setZoomLevel] = useState(1);
    const zoomLevelRef = useRef(zoomLevel);
    zoomLevelRef.current = zoomLevel;
    const [panX, setPanX] = useState(0);
    const [panY, setPanY] = useState(0);
    const panXRef = useRef(panX);
    const panYRef = useRef(panY);
    panXRef.current = panX;
    panYRef.current = panY;

    const isCoarsePointer = useCoarsePointer();
    const touchPointersRef = useRef(new Map<number, { x: number; y: number }>());
    const pinchRef = useRef<{
      startDist: number;
      startZoom: number;
      pointerIds: [number, number];
    } | null>(null);
    /** empty pan / 스페이스·휠 패닝 시 setPointerCapture 한 pointerId */
    const panCapturePointerIdRef = useRef<number | null>(null);

    const prevZoomLevelRef = useRef(zoomLevel);
    const prevFocusRef = useRef({ x: focusCanvasX, y: focusCanvasY });
    const prevPanResetKeyRef = useRef(panResetKey);

    const coverPanBounds = useMemo(() => {
      if (fitMode !== "cover" || vw <= 0 || vh <= 0) return null;
      const { scale } = computeZoomTransform({
        viewportW: vw,
        viewportH: vh,
        contentW: W,
        contentH: H,
        zoomLevel,
        focusCanvasX,
        focusCanvasY,
        panX: 0,
        panY: 0,
        fitMode: "cover",
      });
      return computePanClampBoundsForCover({
        viewportW: vw,
        viewportH: vh,
        contentW: W,
        contentH: H,
        scale,
        focusCanvasX,
        focusCanvasY,
      });
    }, [fitMode, vw, vh, W, H, zoomLevel, focusCanvasX, focusCanvasY]);

    /** contain 모드 + zoom>1: 프레임 바깥 라인이 뷰포트 끝을 벗어나지 않도록 pan 제한 */
    const containPanBounds = useMemo(() => {
      if (fitMode !== "contain" || zoomLevel <= SOLUTION_ZOOM_MIN || vw <= 0 || vh <= 0)
        return null;
      const { scale } = computeZoomTransform({
        viewportW: vw,
        viewportH: vh,
        contentW: W,
        contentH: H,
        zoomLevel,
        focusCanvasX,
        focusCanvasY,
        panX: 0,
        panY: 0,
        fitMode: "contain",
      });
      return computePanClampBoundsForCover({
        viewportW: vw,
        viewportH: vh,
        contentW: W,
        contentH: H,
        scale,
        focusCanvasX,
        focusCanvasY,
      });
    }, [fitMode, zoomLevel, vw, vh, W, H, focusCanvasX, focusCanvasY]);

    /**
     * focus 변경 / 줌 축소·최소 줌: 초점(선택 공 등) 기준으로 다시 맞춤.
     * cover: pan (0,0)에 가깝게 두되, 여백이 생기지 않도록 클램프.
     */
    useLayoutEffect(() => {
      let focusIdentityChanged: boolean;
      if (panResetKey !== undefined) {
        focusIdentityChanged = prevPanResetKeyRef.current !== panResetKey;
        prevPanResetKeyRef.current = panResetKey;
      } else {
        focusIdentityChanged =
          prevFocusRef.current.x !== focusCanvasX ||
          prevFocusRef.current.y !== focusCanvasY;
        if (focusIdentityChanged) {
          prevFocusRef.current = { x: focusCanvasX, y: focusCanvasY };
        }
      }

      const prevZ = prevZoomLevelRef.current;
      const zoomDropped = zoomLevel < prevZ;
      prevZoomLevelRef.current = zoomLevel;
      const atMinZoom = zoomLevel <= SOLUTION_ZOOM_MIN && vw > 0 && vh > 0;
      const shouldResetPan = focusIdentityChanged || zoomDropped || atMinZoom;

      if (fitMode === "cover") {
        if (!coverPanBounds || vw <= 0 || vh <= 0) return;
        if (shouldResetPan) {
          const c = clampPanToCoverBounds(0, 0, coverPanBounds);
          setPanX(c.panX);
          setPanY(c.panY);
          return;
        }
        const c = clampPanToCoverBounds(panXRef.current, panYRef.current, coverPanBounds);
        if (c.panX !== panXRef.current || c.panY !== panYRef.current) {
          setPanX(c.panX);
          setPanY(c.panY);
        }
        return;
      }

      if (fitMode === "contain" && containPanBounds) {
        if (shouldResetPan) {
          const c = clampPanToCoverBounds(0, 0, containPanBounds);
          setPanX(c.panX);
          setPanY(c.panY);
          return;
        }
        const c = clampPanToCoverBounds(panXRef.current, panYRef.current, containPanBounds);
        if (c.panX !== panXRef.current || c.panY !== panYRef.current) {
          setPanX(c.panX);
          setPanY(c.panY);
        }
        return;
      }

      if (shouldResetPan) {
        setPanX(0);
        setPanY(0);
      }
    }, [
      fitMode,
      coverPanBounds,
      containPanBounds,
      focusCanvasX,
      focusCanvasY,
      zoomLevel,
      vw,
      vh,
      panResetKey,
    ]);
    const spaceDownRef = useRef(false);
    const panDragRef = useRef<{ active: boolean; lx: number; ly: number }>({
      active: false,
      lx: 0,
      ly: 0,
    });
    /**
     * zoom&gt;1 빈 곳: down 시 즉시 capture → move가 뷰포트로 옴.
     * panStarted 전까지는 탭 후보(임계값 미만이면 up 시 onEmptyTap).
     */
    const emptyPanGestureRef = useRef<{
      pointerId: number;
      sx: number;
      sy: number;
      panStarted: boolean;
    } | null>(null);

    const [zoomPanelOpen, setZoomPanelOpen] = useState(false);
    const zoomClusterRef = useRef<HTMLDivElement>(null);
    const idleCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearIdleCloseTimer = useCallback(() => {
      if (idleCloseTimerRef.current) {
        clearTimeout(idleCloseTimerRef.current);
        idleCloseTimerRef.current = null;
      }
    }, []);

    const scheduleIdleClose = useCallback(() => {
      clearIdleCloseTimer();
      idleCloseTimerRef.current = setTimeout(() => {
        setZoomPanelOpen(false);
        idleCloseTimerRef.current = null;
      }, ZOOM_PANEL_IDLE_MS);
    }, [clearIdleCloseTimer]);

    useEffect(() => () => clearIdleCloseTimer(), [clearIdleCloseTimer]);

    useEffect(() => {
      if (!zoomPanelOpen) return;
      scheduleIdleClose();
      return () => clearIdleCloseTimer();
    }, [zoomPanelOpen, scheduleIdleClose, clearIdleCloseTimer]);

    useEffect(() => {
      if (!zoomPanelOpen) return;
      const closeIfOutside = (e: MouseEvent | TouchEvent) => {
        const root = zoomClusterRef.current;
        const t = e.target;
        if (!root || !(t instanceof Node)) return;
        if (!root.contains(t)) {
          clearIdleCloseTimer();
          setZoomPanelOpen(false);
        }
      };
      document.addEventListener("mousedown", closeIfOutside);
      document.addEventListener("touchstart", closeIfOutside, { passive: true });
      return () => {
        document.removeEventListener("mousedown", closeIfOutside);
        document.removeEventListener("touchstart", closeIfOutside);
      };
    }, [zoomPanelOpen, clearIdleCloseTimer]);

    useLayoutEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        const r = el.getBoundingClientRect();
        setVw(r.width);
        setVh(r.height);
      });
      ro.observe(el);
      const r = el.getBoundingClientRect();
      setVw(r.width);
      setVh(r.height);
      return () => ro.disconnect();
    }, []);

    const { scale, translateX, translateY } = useMemo(
      () =>
        computeZoomTransform({
          viewportW: vw,
          viewportH: vh,
          contentW: W,
          contentH: H,
          zoomLevel,
          focusCanvasX,
          focusCanvasY,
          panX,
          panY,
          fitMode,
        }),
      [vw, vh, W, H, zoomLevel, focusCanvasX, focusCanvasY, panX, panY, fitMode]
    );

    const transformRef = useRef({ translateX, translateY, scale, vw, vh });
    useLayoutEffect(() => {
      transformRef.current = { translateX, translateY, scale, vw, vh };
    }, [translateX, translateY, scale, vw, vh]);

    const viewportClientToCanvasPx = useCallback(
      (clientX: number, clientY: number) => {
        const r = viewportRef.current?.getBoundingClientRect();
        if (!r) return null;
        const vx = clientX - r.left;
        const vy = clientY - r.top;
        return viewportPxToCanvasPx(vx, vy, translateX, translateY, scale);
      },
      [translateX, translateY, scale]
    );

    const ctxValue = useMemo(
      () => ({
        viewportClientToCanvasPx,
        contentVisualScale: scale > 0 ? scale : 1,
      }),
      [viewportClientToCanvasPx, scale]
    );

    useEffect(() => {
      const down = (e: KeyboardEvent) => {
        if (e.code === "Space") spaceDownRef.current = true;
      };
      const up = (e: KeyboardEvent) => {
        if (e.code === "Space") spaceDownRef.current = false;
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
      };
    }, []);

    const startPan = useCallback((e: React.PointerEvent) => {
      panDragRef.current = { active: true, lx: e.clientX, ly: e.clientY };
    }, []);

    const onPointerDownCapture = useCallback(
      (e: React.PointerEvent) => {
        if (interactionLocked) return;

        if (isCoarsePointer && e.pointerType === "touch") {
          touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (touchPointersRef.current.size >= 2) {
            const ids = Array.from(touchPointersRef.current.keys());
            const id0 = ids[0];
            const id1 = ids[1];
            const p0 = touchPointersRef.current.get(id0)!;
            const p1 = touchPointersRef.current.get(id1)!;
            const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
            if (dist < 10) {
              return;
            }

            emptyPanGestureRef.current = null;
            panDragRef.current.active = false;
            const cap = panCapturePointerIdRef.current;
            if (cap !== null) {
              try {
                viewportRef.current?.releasePointerCapture(cap);
              } catch {
                /* noop */
              }
              panCapturePointerIdRef.current = null;
            }

            pinchRef.current = {
              startDist: dist,
              startZoom: zoomLevelRef.current,
              pointerIds: [id0, id1],
            };
            try {
              viewportRef.current?.setPointerCapture(id0);
              viewportRef.current?.setPointerCapture(id1);
            } catch {
              /* noop */
            }
            panCapturePointerIdRef.current = id1;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        if (e.button === 1) {
          e.preventDefault();
          e.stopPropagation();
          startPan(e);
          viewportRef.current?.setPointerCapture(e.pointerId);
          panCapturePointerIdRef.current = e.pointerId;
          return;
        }
        if (e.button === 0 && spaceDownRef.current) {
          e.preventDefault();
          e.stopPropagation();
          startPan(e);
          viewportRef.current?.setPointerCapture(e.pointerId);
          panCapturePointerIdRef.current = e.pointerId;
          return;
        }
        if (
          e.button === 0 &&
          !spaceDownRef.current &&
          zoomLevel > 1 &&
          panPointerPolicy?.isEmptyForPan(e.clientX, e.clientY, e.target)
        ) {
          e.preventDefault();
          e.stopPropagation();
          emptyPanGestureRef.current = {
            pointerId: e.pointerId,
            sx: e.clientX,
            sy: e.clientY,
            panStarted: false,
          };
          viewportRef.current?.setPointerCapture(e.pointerId);
          panCapturePointerIdRef.current = e.pointerId;
        }
      },
      [interactionLocked, startPan, zoomLevel, panPointerPolicy, isCoarsePointer]
    );

    const onViewportPointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === "touch" && touchPointersRef.current.has(e.pointerId)) {
          touchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        }

        const pinch = pinchRef.current;
        if (pinch && isCoarsePointer) {
          const [id0, id1] = pinch.pointerIds;
          const p0 = touchPointersRef.current.get(id0);
          const p1 = touchPointersRef.current.get(id1);
          if (!p0 || !p1) {
            pinchRef.current = null;
            return;
          }
          const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          if (dist >= 8 && pinch.startDist >= 8) {
            const newZoom = clampZoomLevel(pinch.startZoom * (dist / pinch.startDist));
            const vp = viewportRef.current;
            const r = vp?.getBoundingClientRect();
            const t = transformRef.current;
            if (r && t.vw > 0 && t.vh > 0) {
              const midVx = (p0.x + p1.x) / 2 - r.left;
              const midVy = (p0.y + p1.y) / 2 - r.top;
              const cxcy = viewportPxToCanvasPx(midVx, midVy, t.translateX, t.translateY, t.scale);
              if (cxcy) {
                const oldScale = t.scale;
                const { scale: newScale } = computeZoomTransform({
                  viewportW: t.vw,
                  viewportH: t.vh,
                  contentW: W,
                  contentH: H,
                  zoomLevel: newZoom,
                  focusCanvasX,
                  focusCanvasY,
                  panX: panXRef.current,
                  panY: panYRef.current,
                  fitMode,
                });
                const dS = newScale - oldScale;
                let npx = panXRef.current - (cxcy.x - focusCanvasX) * dS;
                let npy = panYRef.current - (cxcy.y - focusCanvasY) * dS;

                const panBounds =
                  fitMode === "cover"
                    ? computePanClampBoundsForCover({
                        viewportW: t.vw,
                        viewportH: t.vh,
                        contentW: W,
                        contentH: H,
                        scale: newScale,
                        focusCanvasX,
                        focusCanvasY,
                      })
                    : fitMode === "contain" && newZoom > SOLUTION_ZOOM_MIN
                      ? computePanClampBoundsForCover({
                          viewportW: t.vw,
                          viewportH: t.vh,
                          contentW: W,
                          contentH: H,
                          scale: newScale,
                          focusCanvasX,
                          focusCanvasY,
                        })
                      : null;
                if (panBounds) {
                  const c = clampPanToCoverBounds(npx, npy, panBounds);
                  npx = c.panX;
                  npy = c.panY;
                }

                zoomLevelRef.current = newZoom;
                setZoomLevel(newZoom);
                setPanX(npx);
                setPanY(npy);
              }
            }
          }
          e.preventDefault();
          return;
        }

        const g = emptyPanGestureRef.current;
        if (g && g.pointerId === e.pointerId) {
          if (!g.panStarted) {
            const dist = Math.hypot(e.clientX - g.sx, e.clientY - g.sy);
            if (dist >= EMPTY_PAN_MOVE_THRESHOLD_PX) {
              g.panStarted = true;
              panDragRef.current = { active: true, lx: e.clientX, ly: e.clientY };
            }
            return;
          }
          const { lx, ly } = panDragRef.current;
          const dx = e.clientX - lx;
          const dy = e.clientY - ly;
          panDragRef.current = { active: true, lx: e.clientX, ly: e.clientY };
          const panBounds = fitMode === "cover" ? coverPanBounds : containPanBounds;
          if (panBounds) {
            const nx = panXRef.current + dx;
            const ny = panYRef.current + dy;
            const c = clampPanToCoverBounds(nx, ny, panBounds);
            setPanX(c.panX);
            setPanY(c.panY);
          } else {
            setPanX((p) => p + dx);
            setPanY((p) => p + dy);
          }
          return;
        }

        if (!panDragRef.current.active) return;
        const { lx, ly } = panDragRef.current;
        const dx = e.clientX - lx;
        const dy = e.clientY - ly;
        panDragRef.current = { active: true, lx: e.clientX, ly: e.clientY };
        const panBounds = fitMode === "cover" ? coverPanBounds : containPanBounds;
        if (panBounds) {
          const nx = panXRef.current + dx;
          const ny = panYRef.current + dy;
          const c = clampPanToCoverBounds(nx, ny, panBounds);
          setPanX(c.panX);
          setPanY(c.panY);
        } else {
          setPanX((p) => p + dx);
          setPanY((p) => p + dy);
        }
      },
      [fitMode, coverPanBounds, containPanBounds, isCoarsePointer, W, H, focusCanvasX, focusCanvasY]
    );

    const onViewportPointerUp = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === "touch") {
          touchPointersRef.current.delete(e.pointerId);
        }

        const pin = pinchRef.current;
        if (pin && (e.pointerId === pin.pointerIds[0] || e.pointerId === pin.pointerIds[1])) {
          pinchRef.current = null;
          for (const id of pin.pointerIds) {
            try {
              viewportRef.current?.releasePointerCapture(id);
            } catch {
              /* noop */
            }
          }
          panCapturePointerIdRef.current = null;
          panDragRef.current.active = false;
          emptyPanGestureRef.current = null;
          return;
        }

        const g = emptyPanGestureRef.current;
        if (g && g.pointerId === e.pointerId) {
          if (!g.panStarted) {
            panPointerPolicy?.onEmptyTap?.(e.clientX, e.clientY);
          }
          try {
            viewportRef.current?.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
          if (panCapturePointerIdRef.current === e.pointerId) {
            panCapturePointerIdRef.current = null;
          }
          emptyPanGestureRef.current = null;
          panDragRef.current.active = false;
          return;
        }

        if (panDragRef.current.active) {
          try {
            viewportRef.current?.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
          if (panCapturePointerIdRef.current === e.pointerId) {
            panCapturePointerIdRef.current = null;
          }
        }
        panDragRef.current.active = false;
      },
      [panPointerPolicy]
    );

    const bumpZoomPanelIdle = useCallback(() => {
      if (zoomPanelOpen) scheduleIdleClose();
    }, [zoomPanelOpen, scheduleIdleClose]);

    const zoomIn = useCallback(() => {
      setZoomLevel((prev) => clampZoomLevel(prev + SOLUTION_ZOOM_STEP));
      bumpZoomPanelIdle();
    }, [bumpZoomPanelIdle]);

    const zoomOut = useCallback(() => {
      setZoomLevel((prev) => clampZoomLevel(prev - SOLUTION_ZOOM_STEP));
      bumpZoomPanelIdle();
    }, [bumpZoomPanelIdle]);

    useEffect(() => {
      if (!zoomApiRef) return;
      zoomApiRef.current = { zoomIn, zoomOut };
      return () => {
        zoomApiRef.current = null;
      };
    }, [zoomApiRef, zoomIn, zoomOut]);

    const worldStyle: React.CSSProperties = {
      width: W,
      height: H,
      transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
      transformOrigin: "0 0",
      willChange: "transform",
    };

    const renderedChildren =
      typeof children === "function" ? children(ctxValue) : children;

    /** 모바일(coarse pointer): 돋보기·슬라이더 숨김, 핀치만 */
    const showZoomControlsUi = !isCoarsePointer && (!interactionLocked || forceShowZoomControls);

    return (
      <SolutionTableZoomProvider value={ctxValue}>
        <div
          ref={setViewportRef}
          className={`relative overflow-hidden ${isCoarsePointer || zoomLevel > 1 ? "touch-none" : ""} ${className}`}
          data-solution-table-zoom-viewport=""
          onPointerDownCapture={onPointerDownCapture}
          onPointerMove={onViewportPointerMove}
          onPointerUp={onViewportPointerUp}
          onPointerLeave={onViewportPointerUp}
          onPointerCancel={onViewportPointerUp}
        >
          <div className="relative" style={worldStyle}>
            {renderedChildren}
          </div>

          {showZoomControlsUi && (
            <div
              ref={zoomClusterRef}
              className="absolute left-2 top-1/2 z-[115] flex -translate-y-1/2 flex-col items-center gap-2 pointer-events-auto select-none"
              data-solution-table-zoom-controls=""
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label={zoomPanelOpen ? "확대·축소 패널 닫기" : "확대·축소 조절 열기"}
                aria-expanded={zoomPanelOpen}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-white transition active:scale-95 touch-manipulation ${
                  zoomPanelOpen
                    ? "ring-2 ring-white/50 opacity-100"
                    : "opacity-75 ring-1 ring-white/20 hover:opacity-100 hover:ring-white/40"
                }`}
                style={{
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
                }}
                onClick={() => {
                  setZoomPanelOpen((v) => {
                    const next = !v;
                    if (!next) clearIdleCloseTimer();
                    return next;
                  });
                }}
              >
                <MagnifierToggleIcon className="h-6 w-6" />
              </button>
              {zoomPanelOpen && (
                <div
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-white/25 bg-transparent px-1.5 py-2 backdrop-blur-[2px]"
                  onPointerDownCapture={() => bumpZoomPanelIdle()}
                >
                  <button
                    type="button"
                    aria-label="확대"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-transparent text-lg font-bold text-white shadow-[0_2px_10px_rgba(0,0,0,0.4)] hover:border-white/55 touch-manipulation"
                    onClick={() => zoomIn()}
                  >
                    +
                  </button>
                  <input
                    type="range"
                    aria-label="확대 배율"
                    className="h-28 w-8 cursor-pointer accent-white"
                    style={{ writingMode: "vertical-lr", direction: "rtl" }}
                    min={SOLUTION_ZOOM_MIN}
                    max={SOLUTION_ZOOM_MAX}
                    step={0.05}
                    value={zoomLevel}
                    onChange={(e) => {
                      const next = clampZoomLevel(e.target.valueAsNumber);
                      setZoomLevel(next);
                      bumpZoomPanelIdle();
                    }}
                    onInput={() => bumpZoomPanelIdle()}
                  />
                  <button
                    type="button"
                    aria-label="축소"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/35 bg-transparent text-lg font-bold text-white shadow-[0_2px_10px_rgba(0,0,0,0.4)] hover:border-white/55 touch-manipulation"
                    onClick={() => zoomOut()}
                  >
                    −
                  </button>
                  <p
                    className="max-w-[4.75rem] text-center text-[10px] leading-tight text-white/85"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}
                  >
                    확대 시 빈 곳 드래그 또는 스페이스+드래그
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SolutionTableZoomProvider>
    );
  }
);
