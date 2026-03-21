"use client";

import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  getBallRadius,
  getPlayfieldLongSide,
  distanceNormPointsInPlayfieldPx,
  getSolutionPathBallTapRadiusPx,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  landscapeToPortraitNorm,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguPathPoint,
} from "@/lib/nangu-types";
import type { PathPointerAim } from "@/lib/cue-path-cushion-rules";
import { classifySolutionPathPointerHit } from "@/lib/solution-path-pointer-classify";
import { cueFirstObjectHitAmongNormalized } from "@/lib/solution-path-geometry";
import { buildCuePathSegments, buildObjectPathSegments } from "@/lib/solution-path-types";

/** 수구 진행 경로 */
const CUE_PATH_STROKE = "rgb(239, 68, 68)";
/** 1목적구(반사) 진행 경로 */
const OBJECT_PATH_STROKE = "rgb(125, 211, 252)";
const LINE_WIDTH = 2.5;
const SPOT_DOT_RADIUS = 3;
/** 화살표 제외 스팟점 색 — 깜빡임은 opacity로 (수구 스팟 깜빡임과 동일 주기: `BilliardTableCanvas` rAF) */
const SPOT_DOT_FILL = "#000000";
const ARROW_LEN = 14;
const ARROW_HALF_WIDTH = 6;
function arrowHeadPolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * ARROW_LEN;
  const by = y2 - uy * ARROW_LEN;
  const px = -uy * ARROW_HALF_WIDTH;
  const py = ux * ARROW_HALF_WIDTH;
  return `${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

/**
 * 수구 경로(빨강) + 1목적구 경로(하늘).
 * - 수구 경로: 첫 선분은 항상 **수구**에서 시작(`buildCuePathSegments`).
 * - 첫 스팟은 **1목 후보(수구 제외 2구 중 하나)** 또는 **플레이필드·쿠션 경계**; 마지막 끝 화살표는 부모에서 `showCuePathLastArrow` 등으로 제어(전체화면 편집기는 3초 유휴 후).
 * - 1목 경로는 충돌점에서 시작.
 */
export function NanguSolutionPathOverlay({
  pathPoints,
  cuePos,
  objectBallNorm,
  objectPathPoints = [],
  /** 캔버스와 동일 — portrait 시 테이블 긴 변이 세로(당구노트 공배치 전체화면과 동일) */
  orientation = "landscape" as TableOrientation,
  pathMode = false,
  objectPathMode = false,
  getNormalizedFromEvent,
  /** 플레이필드 내 norm | 테이블 캔버스(px) — 쿠션·프레임 탭 시 반직선 교차용 */
  getPointerAimFromEvent,
  onAddPoint,
  onAddCuePathAim,
  onInsertCuePathAim,
  onRemovePoint,
  onMovePoint,
  onInsertBetween,
  onAddObjectPoint,
  onAddObjectPathAim,
  onRemoveObjectPoint,
  onMoveObjectPoint,
  onInsertObjectBetween,
  onInsertObjectPathAim,
  pathLinesVisible = true,
  /** 경로 입력 모드에서 공 탭 시 줌 초점(캔버스 픽셀) */
  onZoomSetFocusCanvasPx,
  /** 공 탭 히트용 배치 (오버레이와 동일 width/height 좌표계) */
  ballPickLayout,
  /** 충돌·1목 경로 표시용 — 미리보기 등 `ballPickLayout`이 없을 때도 `getNonCueBallNorms`에 사용 */
  tableBallPlacement,
  ballNormOverrides,
  /**
   * 마지막 세그먼트 끝 화살표 표시. false면 마지막 스팟은 점만(다음 연결 전·3초 미경과 UX).
   * @default true
   */
  showCuePathLastArrow = true,
  /** 1목 경로 마지막 세그먼트 화살표 — 위와 동일 규칙 */
  showObjectPathLastArrow = true,
  /** 경로 입력 모드가 꺼져 있어도 수구 탭 히트(노트 전체화면 재생 UX) */
  allowCuePlaybackGestures = false,
  /** 수구 단일 탭(예: 재생 종료 후 원위치) */
  onCueBallSingleTap,
  /** 수구 더블 탭 — 보통 `showCuePathLastArrow`일 때만 호출 */
  onCueBallDoubleTap,
}: {
  pathPoints: NanguPathPoint[];
  cuePos: { x: number; y: number };
  /** 레거시: 배치 없이 빨간 공만 알 때 */
  objectBallNorm?: { x: number; y: number } | null;
  objectPathPoints?: NanguPathPoint[];
  /** landscape: 긴 변 가로. portrait: 당구노트 공배치 전체화면과 같이 긴 변 세로 */
  orientation?: TableOrientation;
  pathMode?: boolean;
  objectPathMode?: boolean;
  getNormalizedFromEvent?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  getPointerAimFromEvent?: (clientX: number, clientY: number) => PathPointerAim | null;
  onAddPoint?: (norm: { x: number; y: number }) => void;
  onAddCuePathAim?: (aim: PathPointerAim) => void;
  onInsertCuePathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  onRemovePoint?: (id: string) => void;
  onMovePoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onAddObjectPoint?: (norm: { x: number; y: number }) => void;
  onAddObjectPathAim?: (aim: PathPointerAim) => void;
  onRemoveObjectPoint?: (id: string) => void;
  onMoveObjectPoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertObjectBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onInsertObjectPathAim?: (segmentIndex: number, aim: PathPointerAim) => void;
  /** false면 경로선·스팟·화살표·수구 보조 링 숨김 (재생 중 토글) */
  pathLinesVisible?: boolean;
  onZoomSetFocusCanvasPx?: (canvasX: number, canvasY: number) => void;
  ballPickLayout?: NanguBallPlacement | null;
  tableBallPlacement?: NanguBallPlacement | null;
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  showCuePathLastArrow?: boolean;
  showObjectPathLastArrow?: boolean;
  allowCuePlaybackGestures?: boolean;
  onCueBallSingleTap?: () => void;
  onCueBallDoubleTap?: () => void;
}) {
  /** 저장/충돌 계산은 항상 landscape 플레이필드 기준 */
  const collisionRect = useMemo(
    () => getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT),
    []
  );
  const canvasW = orientation === "portrait" ? DEFAULT_TABLE_HEIGHT : DEFAULT_TABLE_WIDTH;
  const canvasH = orientation === "portrait" ? DEFAULT_TABLE_WIDTH : DEFAULT_TABLE_HEIGHT;
  const drawRect = useMemo(() => getPlayfieldRect(canvasW, canvasH), [canvasW, canvasH]);
  const ballR = getBallRadius(getPlayfieldLongSide(drawRect));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const lastClickRef = useRef<{ id: string; t: number; kind: "cue" | "obj" } | null>(null);
  /** 브라우저 setTimeout 핸들 (number). Node `Timeout`과 병합 타입 충돌 방지 */
  const cueBallGestureRef = useRef<{ t: number; timer: number } | null>(null);

  useEffect(() => {
    return () => {
      const p = cueBallGestureRef.current;
      if (p?.timer) clearTimeout(p.timer);
    };
  }, []);

  const toPx = useCallback(
    (x: number, y: number) => {
      const n = orientation === "portrait" ? landscapeToPortraitNorm(x, y) : { x, y };
      const { px, py } = normalizedToPixel(n.x, n.y, drawRect);
      return { px, py };
    },
    [orientation, drawRect]
  );

  const firstObjectBallsForCollision = useMemo(() => {
    const src = tableBallPlacement ?? ballPickLayout ?? null;
    if (src) return getNonCueBallNorms(src);
    if (objectBallNorm) return [{ key: "red" as const, x: objectBallNorm.x, y: objectBallNorm.y }];
    return null;
  }, [tableBallPlacement, ballPickLayout, objectBallNorm]);

  const collisionNorm = useMemo(() => {
    if (!firstObjectBallsForCollision?.length || pathPoints.length < 1) return null;
    return (
      cueFirstObjectHitAmongNormalized(cuePos, pathPoints[0], firstObjectBallsForCollision, collisionRect)
        ?.collision ?? null
    );
  }, [firstObjectBallsForCollision, pathPoints, cuePos, collisionRect]);

  const cueSegmentsNorm = useMemo(
    () => buildCuePathSegments(cuePos, pathPoints),
    [cuePos, pathPoints]
  );

  const objectSegmentsNorm = useMemo(() => {
    if (!collisionNorm || objectPathPoints.length < 1) return [];
    return buildObjectPathSegments(collisionNorm, objectPathPoints);
  }, [collisionNorm, objectPathPoints]);

  const cuePxSegs = useMemo(
    () =>
      cueSegmentsNorm.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [cueSegmentsNorm, toPx]
  );

  const objectPxSegs = useMemo(
    () =>
      objectSegmentsNorm.map((s) => ({
        x1: toPx(s.start.x, s.start.y).px,
        y1: toPx(s.start.x, s.start.y).py,
        x2: toPx(s.end.x, s.end.y).px,
        y2: toPx(s.end.x, s.end.y).py,
      })),
    [objectSegmentsNorm, toPx]
  );

  const cuePx = toPx(cuePos.x, cuePos.y);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!getNormalizedFromEvent && !getPointerAimFromEvent) return;
      let aim: PathPointerAim | null = null;
      if (getPointerAimFromEvent) {
        aim = getPointerAimFromEvent(e.clientX, e.clientY);
      } else {
        const n = getNormalizedFromEvent?.(e.clientX, e.clientY);
        aim = n ? { kind: "playfield", norm: n } : null;
      }
      if (!aim) return;
      const now = Date.now();

      if (aim.kind === "tableCanvas") {
        const { cx, cy } = aim;
        if (ballPickLayout && onZoomSetFocusCanvasPx) {
          const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
          const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
          const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
          const ballTapR = getSolutionPathBallTapRadiusPx(collisionRect);
          for (const b of [rb, yb, wb]) {
            const { px, py } = toPx(b.x, b.y);
            if (Math.hypot(cx - px, cy - py) <= ballTapR) {
              onZoomSetFocusCanvasPx(px, py);
              e.stopPropagation();
              e.preventDefault();
              return;
            }
          }
        }
        if (objectPathMode && collisionNorm && onAddObjectPathAim) {
          onAddObjectPathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        if (pathMode && onAddCuePathAim) {
          onAddCuePathAim(aim);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        return;
      }

      const norm = aim.norm;
      const c = classifySolutionPathPointerHit({
        norm,
        pathMode,
        objectPathMode,
        cuePos,
        pathPoints,
        objectPathPoints,
        objectBallNorm,
        ballPickLayout,
        collisionLayout: tableBallPlacement ?? ballPickLayout ?? null,
        ballNormOverrides,
        width: DEFAULT_TABLE_WIDTH,
        height: DEFAULT_TABLE_HEIGHT,
        allowCuePlaybackGestures: Boolean(allowCuePlaybackGestures),
      });

      if (c.kind === "inactive") return;

      const cueGestureLayout = ballPickLayout ?? tableBallPlacement ?? null;
      const hasCuePlaybackHandlers = Boolean(onCueBallSingleTap || onCueBallDoubleTap);
      let isCueBallHitForGesture = c.kind === "cueBallPlayback";
      if (!isCueBallHitForGesture && c.kind === "ball" && cueGestureLayout) {
        const ck = cueGestureLayout.cueBall === "yellow" ? "yellow" : ("white" as const);
        const cn =
          ballNormOverrides?.[ck] ??
          (ck === "yellow" ? cueGestureLayout.yellowBall : cueGestureLayout.whiteBall);
        const tapR = getSolutionPathBallTapRadiusPx(collisionRect);
        isCueBallHitForGesture =
          distanceNormPointsInPlayfieldPx(norm, cn, collisionRect) <= tapR;
      }
      if (
        hasCuePlaybackHandlers &&
        cueGestureLayout &&
        pathPoints.length >= 1 &&
        isCueBallHitForGesture
      ) {
        const now = Date.now();
        const prev = cueBallGestureRef.current;
        if (prev && now - prev.t < 400) {
          if (prev.timer) clearTimeout(prev.timer);
          cueBallGestureRef.current = null;
          if (showCuePathLastArrow && onCueBallDoubleTap) {
            onCueBallDoubleTap();
          } else {
            onCueBallSingleTap?.();
          }
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        const tRef = cueBallGestureRef;
        const timer = window.setTimeout(() => {
          tRef.current = null;
          onCueBallSingleTap?.();
        }, 400);
        cueBallGestureRef.current = { t: now, timer };
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "ball") {
        if (!ballPickLayout || !onZoomSetFocusCanvasPx) return;
        const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
        const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
        const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
        const ballTapR = getSolutionPathBallTapRadiusPx(collisionRect);
        for (const b of [rb, yb, wb]) {
          if (distanceNormPointsInPlayfieldPx(norm, b, collisionRect) <= ballTapR) {
            const { px, py } = toPx(b.x, b.y);
            onZoomSetFocusCanvasPx(px, py);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        return;
      }

      if (c.kind === "objectSpot") {
        const p = objectPathPoints.find((x) => x.id === c.id);
        if (!p) return;
        const last = lastClickRef.current;
        if (last?.kind === "obj" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          onRemoveObjectPoint?.(p.id);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "obj" };
        setDraggingObjectId(p.id);
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "objectSegment") {
        if (onInsertObjectPathAim) onInsertObjectPathAim(c.segmentIndex, aim);
        else onInsertObjectBetween?.(c.segmentIndex, norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyObject") {
        if (onAddObjectPathAim) onAddObjectPathAim(aim);
        else onAddObjectPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSpot") {
        const p = pathPoints.find((x) => x.id === c.id);
        if (!p) return;
        const last = lastClickRef.current;
        if (last?.kind === "cue" && last?.id === p.id && now - last.t < 400) {
          lastClickRef.current = null;
          onRemovePoint?.(p.id);
          e.stopPropagation();
          e.preventDefault();
          return;
        }
        lastClickRef.current = { id: p.id, t: now, kind: "cue" };
        setDraggingId(p.id);
        {
          const { px, py } = toPx(p.x, p.y);
          onZoomSetFocusCanvasPx?.(px, py);
        }
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "cueSegment") {
        if (onInsertCuePathAim) onInsertCuePathAim(c.segmentIndex, aim);
        else onInsertBetween?.(c.segmentIndex, norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (c.kind === "emptyCue") {
        /** 마지막이 쿠션(스팟점)이면 플레이필드 어디를 탭해도 스냅 기준으로 다음 스팟 연결 — 반직선 실패 없이 */
        const lastCue = pathPoints[pathPoints.length - 1];
        if (lastCue?.type === "cushion" && getNormalizedFromEvent) {
          const n = getNormalizedFromEvent(e.clientX, e.clientY);
          if (n) {
            onAddPoint?.(n);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        if (onAddCuePathAim) onAddCuePathAim(aim);
        else onAddPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [
      pathMode,
      objectPathMode,
      getNormalizedFromEvent,
      getPointerAimFromEvent,
      pathPoints,
      objectPathPoints,
      cuePos,
      objectBallNorm,
      tableBallPlacement,
      onAddPoint,
      onAddCuePathAim,
      onInsertCuePathAim,
      onRemovePoint,
      onInsertBetween,
      onAddObjectPoint,
      onAddObjectPathAim,
      onRemoveObjectPoint,
      onInsertObjectBetween,
      onInsertObjectPathAim,
      ballPickLayout,
      ballNormOverrides,
      onZoomSetFocusCanvasPx,
      toPx,
      collisionRect,
      collisionNorm,
      allowCuePlaybackGestures,
      onCueBallSingleTap,
      onCueBallDoubleTap,
      showCuePathLastArrow,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!getNormalizedFromEvent) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      if (draggingObjectId && onMoveObjectPoint) {
        onMoveObjectPoint(draggingObjectId, norm);
        e.preventDefault();
        return;
      }
      if (draggingId && onMovePoint) {
        onMovePoint(draggingId, norm);
        e.preventDefault();
      }
    },
    [draggingId, draggingObjectId, getNormalizedFromEvent, onMovePoint, onMoveObjectPoint]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
    setDraggingObjectId(null);
  }, []);

  const interactive = pathMode || objectPathMode || Boolean(allowCuePlaybackGestures);

  /** 수구 표시 깜빡임과 동일: `Date.now()/180` 기준 sin 부호 → 0|1 (`BilliardTableCanvas` showCueBallSpot) */
  const [spotBlink01, setSpotBlink01] = useState(1);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const t = Date.now() / 180;
      setSpotBlink01(Math.sin(t) >= 0 ? 1 : 0);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={canvasW}
        height={canvasH}
        viewBox={`0 0 ${canvasW} ${canvasH}`}
      >
        {/* 수구 경로 */}
        {pathLinesVisible &&
          cuePxSegs.map((seg, i) => (
            <line
              key={`cue-seg-${i}`}
              x1={seg.x1}
              y1={seg.y1}
              x2={seg.x2}
              y2={seg.y2}
              stroke={CUE_PATH_STROKE}
              strokeWidth={LINE_WIDTH}
              strokeLinecap="round"
            />
          ))}
        {pathLinesVisible &&
          showCuePathLastArrow &&
          cuePxSegs.length > 0 &&
          pathPoints.length > 0 &&
          (() => {
            const last = cuePxSegs[cuePxSegs.length - 1];
            return (
              <polygon
                points={arrowHeadPolygon(last.x1, last.y1, last.x2, last.y2)}
                fill={CUE_PATH_STROKE}
              />
            );
          })()}

        {/* 1목적구 경로 */}
        {pathLinesVisible &&
          objectPxSegs.map((seg, i) => (
          <line
            key={`obj-seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={OBJECT_PATH_STROKE}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
          />
        ))}
        {pathLinesVisible &&
          showObjectPathLastArrow &&
          objectPxSegs.length > 0 &&
          (() => {
            const last = objectPxSegs[objectPxSegs.length - 1];
            return (
              <polygon
                points={arrowHeadPolygon(last.x1, last.y1, last.x2, last.y2)}
                fill={OBJECT_PATH_STROKE}
              />
            );
          })()}

        {pathLinesVisible && (
          <g>
            <circle
              cx={cuePx.px}
              cy={cuePx.py}
              r={ballR}
              fill="none"
              stroke="rgba(30, 64, 175, 0.85)"
              strokeWidth={2.5}
            />
            <text
              x={cuePx.px}
              y={cuePx.py}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="rgb(30, 64, 175)"
              fontSize={Math.max(10, ballR * 0.5)}
              fontWeight="600"
            >
              수구
            </text>
          </g>
        )}

        {/* 수구 경로 스팟: 마지막은 화살표 표시 시에만 점 생략(3초 유휴 전에는 마지막도 점) */}
        {pathLinesVisible &&
          pathPoints.map((p, idx) => {
          if (idx === pathPoints.length - 1 && showCuePathLastArrow) return null;
          const { px, py } = toPx(p.x, p.y);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={SPOT_DOT_RADIUS}
              fill={SPOT_DOT_FILL}
              fillOpacity={spotBlink01}
            />
          );
        })}

        {/* 1목 경로 스팟 — 마지막 점/화살표 규칙은 수구와 동일 */}
        {pathLinesVisible &&
          objectPathPoints.map((p, idx) => {
          if (idx === objectPathPoints.length - 1 && showObjectPathLastArrow) return null;
          const { px, py } = toPx(p.x, p.y);
          return (
            <circle
              key={p.id}
              cx={px}
              cy={py}
              r={SPOT_DOT_RADIUS}
              fill={SPOT_DOT_FILL}
              fillOpacity={spotBlink01}
            />
          );
        })}
      </svg>
    </div>
  );
}
