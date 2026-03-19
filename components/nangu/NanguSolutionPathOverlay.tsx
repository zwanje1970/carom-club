"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  getBallRadius,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguPathPoint } from "@/lib/nangu-types";

const PATH_COLOR = "rgba(255, 80, 80, 0.9)";
const SPOT_FILL = "rgba(255, 80, 80, 0.2)";
const SPOT_STROKE = "rgb(220, 50, 50)";
const SPOT_DOT = "rgb(200, 40, 40)";
const LINE_WIDTH = 2.5;
/** 화살표 크기: 선과 어울리도록 작게 (끝 방향만 인지) */
const ARROW_SIZE = 5;
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

/** 진행선 SVG 오버레이: 수구에서 시작, 스팟 연결, 마지막 선만 화살표. 수구 위치에 "수구" 라벨 표시. pathMode 시 스팟 드래그/삭제/선분 클릭 삽입 */
export function NanguSolutionPathOverlay({
  pathPoints,
  cuePos,
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
  pathMode = false,
  getNormalizedFromEvent,
  onAddPoint,
  onRemovePoint,
  onMovePoint,
  onInsertBetween,
}: {
  pathPoints: NanguPathPoint[];
  cuePos: { x: number; y: number };
  width?: number;
  height?: number;
  pathMode?: boolean;
  getNormalizedFromEvent?: (clientX: number, clientY: number) => { x: number; y: number } | null;
  onAddPoint?: (norm: { x: number; y: number }) => void;
  onRemovePoint?: (id: string) => void;
  onMovePoint?: (id: string, norm: { x: number; y: number }) => void;
  onInsertBetween?: (segmentIndex: number, norm: { x: number; y: number }) => void;
}) {
  const rect = getPlayfieldRect(width, height);
  const longSide = Math.max(rect.width, rect.height);
  const ballR = getBallRadius(longSide);
  const spotDisplayR = ballR;
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const lastClickRef = useRef<{ id: string; t: number } | null>(null);

  const toPx = useCallback(
    (x: number, y: number) => {
      const { px, py } = normalizedToPixel(x, y, rect);
      return { px, py };
    },
    [rect]
  );

  /* 진행선: 반드시 수구(cuePos)에서 시작. 첫 선 = 수구 중심 → pathPoints[0] */
  const allX = [cuePos.x, ...pathPoints.map((p) => p.x)];
  const allY = [cuePos.y, ...pathPoints.map((p) => p.y)];
  const segments: { x1: number; y1: number; x2: number; y2: number; isLast: boolean }[] = [];
  for (let i = 0; i < allX.length - 1; i++) {
    const a = toPx(allX[i], allY[i]);
    const b = toPx(allX[i + 1], allY[i + 1]);
    segments.push({
      x1: a.px,
      y1: a.py,
      x2: b.px,
      y2: b.py,
      isLast: i === allX.length - 2,
    });
  }

  const cuePx = toPx(cuePos.x, cuePos.y);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!pathMode || !getNormalizedFromEvent) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      const now = Date.now();
      for (let i = 0; i < pathPoints.length; i++) {
        const p = pathPoints[i];
        if (Math.hypot(p.x - norm.x, p.y - norm.y) < SPOT_HIT_NORM) {
          const last = lastClickRef.current;
          if (last?.id === p.id && now - last.t < 400) {
            lastClickRef.current = null;
            onRemovePoint?.(p.id);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
          lastClickRef.current = { id: p.id, t: now };
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
    },
    [pathMode, getNormalizedFromEvent, pathPoints, segments, rect, onAddPoint, onRemovePoint, onInsertBetween]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingId || !getNormalizedFromEvent || !onMovePoint) return;
      const norm = getNormalizedFromEvent(e.clientX, e.clientY);
      if (!norm) return;
      onMovePoint(draggingId, norm);
      e.preventDefault();
    },
    [draggingId, getNormalizedFromEvent, onMovePoint]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingId(null);
  }, []);

  return (
    <div
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: pathMode ? "auto" : "none" }}
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
        <defs>
          <marker
            id="path-arrow"
            markerWidth={ARROW_SIZE * 2}
            markerHeight={ARROW_SIZE * 2}
            refX={ARROW_SIZE * 2}
            refY={ARROW_SIZE}
            orient="auto"
          >
            <polygon
              points={`${ARROW_SIZE * 2},${ARROW_SIZE} 0,0 0,${ARROW_SIZE * 2}`}
              fill={PATH_COLOR}
            />
          </marker>
        </defs>
        {segments.map((seg, i) => (
          <line
            key={`seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={PATH_COLOR}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            markerEnd={seg.isLast ? "url(#path-arrow)" : undefined}
          />
        ))}
        {/* 수구 표시: 외곽선 강조 + 라벨 (진행선 시작점 명확화) */}
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
        {pathPoints.map((p) => {
          const { px, py } = toPx(p.x, p.y);
          return (
            <g key={p.id}>
              <circle
                cx={px}
                cy={py}
                r={spotDisplayR}
                fill={SPOT_FILL}
                stroke={SPOT_STROKE}
                strokeWidth={1.5}
              />
              <circle cx={px} cy={py} r={3} fill={SPOT_DOT} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
