"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  getBallRadius,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguPathPoint } from "@/lib/nangu-types";
import { cueObjectCollisionNormalized } from "@/lib/solution-path-geometry";
import { buildCuePathSegments, buildObjectPathSegments } from "@/lib/solution-path-types";

/** 수구 진행 경로 */
const CUE_PATH_STROKE = "rgb(239, 68, 68)";
/** 1목적구(반사) 진행 경로 */
const OBJECT_PATH_STROKE = "rgb(125, 211, 252)";
const LINE_WIDTH = 2.5;
const SPOT_DOT_RADIUS = 3;
const ARROW_LEN = 14;
const ARROW_HALF_WIDTH = 6;
const SPOT_HIT_NORM = 0.06;
const SEGMENT_HIT_NORM = 0.04;

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

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
 * - 모든 선은 직선분, 수구/충돌점에서 시작.
 * - 스팟은 작은 점, 마지막 스팟은 화살표(점 없음).
 */
export function NanguSolutionPathOverlay({
  pathPoints,
  cuePos,
  objectBallNorm,
  objectPathPoints = [],
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
  pathMode = false,
  objectPathMode = false,
  getNormalizedFromEvent,
  onAddPoint,
  onRemovePoint,
  onMovePoint,
  onInsertBetween,
  onAddObjectPoint,
  onRemoveObjectPoint,
  onMoveObjectPoint,
  onInsertObjectBetween,
}: {
  pathPoints: NanguPathPoint[];
  cuePos: { x: number; y: number };
  /** 1목적구(red) 정규화 좌표. 없으면 1목 경로·충돌 계산 생략 */
  objectBallNorm?: { x: number; y: number } | null;
  objectPathPoints?: NanguPathPoint[];
  width?: number;
  height?: number;
  pathMode?: boolean;
  objectPathMode?: boolean;
  getNormalizedFromEvent?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onAddPoint?: (norm: { x: number; y: number }) => void;
  onRemovePoint?: (id: string) => void;
  onMovePoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
  onAddObjectPoint?: (norm: { x: number; y: number }) => void;
  onRemoveObjectPoint?: (id: string) => void;
  onMoveObjectPoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertObjectBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
}) {
  const rect = getPlayfieldRect(width, height);
  const longSide = Math.max(rect.width, rect.height);
  const ballR = getBallRadius(longSide);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const lastClickRef = useRef<{ id: string; t: number; kind: "cue" | "obj" } | null>(null);

  const toPx = useCallback(
    (x: number, y: number) => {
      const { px, py } = normalizedToPixel(x, y, rect);
      return { px, py };
    },
    [rect]
  );

  const collisionNorm = useMemo(() => {
    if (!objectBallNorm || pathPoints.length < 1) return null;
    return cueObjectCollisionNormalized(cuePos, pathPoints[0], objectBallNorm, rect);
  }, [objectBallNorm, pathPoints, cuePos, rect]);

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
      if (!getNormalizedFromEvent) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      const now = Date.now();

      if (objectPathMode && collisionNorm) {
        for (let i = 0; i < objectPathPoints.length; i++) {
          const p = objectPathPoints[i];
          if (Math.hypot(p.x - norm.x, p.y - norm.y) < SPOT_HIT_NORM) {
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
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        const objChain = [collisionNorm, ...objectPathPoints.map((p) => ({ x: p.x, y: p.y }))];
        for (let i = 0; i < objChain.length - 1; i++) {
          const a = objChain[i];
          const b = objChain[i + 1];
          const dist = distToSegment(norm.x, norm.y, a.x, a.y, b.x, b.y);
          if (dist < SEGMENT_HIT_NORM) {
            onInsertObjectBetween?.(i, norm);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        onAddObjectPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
        return;
      }

      if (pathMode) {
        for (let i = 0; i < pathPoints.length; i++) {
          const p = pathPoints[i];
          if (Math.hypot(p.x - norm.x, p.y - norm.y) < SPOT_HIT_NORM) {
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
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        const allPts = [cuePos, ...pathPoints];
        for (let i = 0; i < allPts.length - 1; i++) {
          const a = allPts[i];
          const b = allPts[i + 1];
          const dist = distToSegment(norm.x, norm.y, a.x, a.y, b.x, b.y);
          if (dist < SEGMENT_HIT_NORM) {
            onInsertBetween?.(i, norm);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
        onAddPoint?.(norm);
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [
      pathMode,
      objectPathMode,
      collisionNorm,
      getNormalizedFromEvent,
      pathPoints,
      objectPathPoints,
      cuePos,
      onAddPoint,
      onRemovePoint,
      onInsertBetween,
      onAddObjectPoint,
      onRemoveObjectPoint,
      onInsertObjectBetween,
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

  const interactive = pathMode || objectPathMode;

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
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
      >
        {/* 수구 경로 */}
        {cuePxSegs.map((seg, i) => (
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
        {cuePxSegs.length > 0 &&
          pathPoints.length > 0 &&
          pathPoints[pathPoints.length - 1]?.type === "end" &&
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
        {objectPxSegs.map((seg, i) => (
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
        {objectPxSegs.length > 0 && (() => {
          const last = objectPxSegs[objectPxSegs.length - 1];
          return (
            <polygon
              points={arrowHeadPolygon(last.x1, last.y1, last.x2, last.y2)}
              fill={OBJECT_PATH_STROKE}
            />
          );
        })()}

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

        {/* 수구 경로 스팟: end 타입은 화살표만(점 없음), 나머지는 작은 점 */}
        {pathPoints.map((p) => {
          if (p.type === "end") return null;
          const { px, py } = toPx(p.x, p.y);
          return <circle key={p.id} cx={px} cy={py} r={SPOT_DOT_RADIUS} fill={CUE_PATH_STROKE} />;
        })}

        {/* 1목 경로 스팟 (마지막은 화살표만 — 점 생략) */}
        {objectPathPoints.map((p, idx) => {
          if (idx === objectPathPoints.length - 1) return null;
          const { px, py } = toPx(p.x, p.y);
          return <circle key={p.id} cx={px} cy={py} r={SPOT_DOT_RADIUS} fill={OBJECT_PATH_STROKE} />;
        })}
      </svg>
    </div>
  );
}
