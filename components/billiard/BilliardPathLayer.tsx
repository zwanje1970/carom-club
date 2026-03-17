"use client";

/**
 * 경로 편집 오버레이: 테이블 클릭 → 스팟 추가, 스팟 드래그로 경로 수정.
 * 기존 Canvas/Editor를 건드리지 않고 overlay로 동작.
 * 좌표는 0..1 정규화, playfield 기준.
 */
import React, { useRef, useCallback, useState } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  pixelToNormalized,
  clampPathPointToAllowedRegion,
  landscapeToPortraitNorm,
  portraitToLandscapeNorm,
  type CueBallType,
  type TableOrientation,
} from "@/lib/billiard-table-constants";
import type { BilliardPath } from "@/lib/billiard-path-types";

const SPOT_HIT_RADIUS_PX = 14;
const CUE_HIT_RADIUS_PX = 16;

function getPathSpotPositions(
  paths: BilliardPath[],
  cueBall: CueBallType,
  whiteBall: { x: number; y: number },
  yellowBall: { x: number; y: number }
): { pathIndex: number; pointIndex: number; x: number; y: number }[] {
  const out: { pathIndex: number; pointIndex: number; x: number; y: number }[] = [];
  paths.forEach((path, pathIndex) => {
    const start =
      path.start.type === "cueBall"
        ? cueBall === "white"
          ? whiteBall
          : yellowBall
        : { x: path.start.x, y: path.start.y };
    out.push({ pathIndex, pointIndex: -1, x: start.x, y: start.y });
    path.points.forEach((p, i) => {
      out.push({ pathIndex, pointIndex: i, x: p.x, y: p.y });
    });
  });
  return out;
}

export interface BilliardPathLayerProps {
  width: number;
  height: number;
  paths: BilliardPath[];
  cueBall: CueBallType;
  whiteBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  orientation?: TableOrientation;
  onTableClick: (normalized: { x: number; y: number }) => void;
  onCueBallClick: () => void;
  onSpotDrag: (
    pathIndex: number,
    pointIndex: number,
    normalized: { x: number; y: number }
  ) => void;
}

export function BilliardPathLayer({
  width,
  height,
  paths,
  cueBall,
  whiteBall,
  yellowBall,
  orientation = "landscape",
  onTableClick,
  onCueBallClick,
  onSpotDrag,
}: BilliardPathLayerProps) {
  const rect = getPlayfieldRect(width, height);
  const isPortrait = orientation === "portrait";
  const toView = (x: number, y: number) =>
    isPortrait ? landscapeToPortraitNorm(x, y) : { x, y };
  const toLandscape = (x: number, y: number) =>
    isPortrait ? portraitToLandscapeNorm(x, y) : { x, y };
  const [dragging, setDragging] = useState<{
    pathIndex: number;
    pointIndex: number;
  } | null>(null);

  const getEventCanvasCoords = useCallback(
    (clientX: number, clientY: number, target: HTMLElement) => {
      const r = target.getBoundingClientRect();
      const scaleX = width / r.width;
      const scaleY = height / r.height;
      const px = (clientX - r.left) * scaleX;
      const py = (clientY - r.top) * scaleY;
      return { px, py };
    },
    [width, height]
  );

  const hitTest = useCallback(
    (px: number, py: number) => {
      const spots = getPathSpotPositions(paths, cueBall, whiteBall, yellowBall);
      for (let i = spots.length - 1; i >= 0; i--) {
        const s = spots[i];
        const v = toView(s.x, s.y);
        const { px: sx, py: sy } = normalizedToPixel(v.x, v.y, rect);
        const dist = Math.hypot(px - sx, py - sy);
        if (dist <= SPOT_HIT_RADIUS_PX) {
          return { type: "spot" as const, pathIndex: s.pathIndex, pointIndex: s.pointIndex };
        }
      }
      const cuePos = cueBall === "white" ? whiteBall : yellowBall;
      const vc = toView(cuePos.x, cuePos.y);
      const { px: cx, py: cy } = normalizedToPixel(vc.x, vc.y, rect);
      if (Math.hypot(px - cx, py - cy) <= CUE_HIT_RADIUS_PX) {
        return { type: "cue" as const };
      }
      if (
        px >= rect.left &&
        px <= rect.left + rect.width &&
        py >= rect.top &&
        py <= rect.top + rect.height
      ) {
        const norm = pixelToNormalized(px, py, rect);
        const landscape = toLandscape(norm.x, norm.y);
        return { type: "table" as const, ...landscape };
      }
      return null;
    },
    [paths, cueBall, whiteBall, yellowBall, rect, isPortrait]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const target = e.currentTarget as HTMLElement;
      const { px, py } = getEventCanvasCoords(e.clientX, e.clientY, target);
      const hit = hitTest(px, py);
      if (hit?.type === "spot") {
        e.preventDefault();
        setDragging({ pathIndex: hit.pathIndex, pointIndex: hit.pointIndex });
        (target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    },
    [getEventCanvasCoords, hitTest]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const target = e.currentTarget as HTMLElement;
      const { px, py } = getEventCanvasCoords(e.clientX, e.clientY, target);
      if (
        px >= rect.left &&
        px <= rect.left + rect.width &&
        py >= rect.top &&
        py <= rect.top + rect.height
      ) {
        const norm = pixelToNormalized(px, py, rect);
        const landscape = toLandscape(norm.x, norm.y);
        const clamped = clampPathPointToAllowedRegion(landscape.x, landscape.y);
        onSpotDrag(dragging.pathIndex, dragging.pointIndex, clamped);
      }
    },
    [dragging, getEventCanvasCoords, rect, onSpotDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
        setDragging(null);
      }
    },
    [dragging]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const { px, py } = getEventCanvasCoords(e.clientX, e.clientY, target);
      const hit = hitTest(px, py);
      if (hit?.type === "cue") {
        e.preventDefault();
        onCueBallClick();
        return;
      }
      if (hit?.type === "table") {
        e.preventDefault();
        const clamped = clampPathPointToAllowedRegion(hit.x, hit.y);
        onTableClick(clamped);
      }
    },
    [getEventCanvasCoords, hitTest, onCueBallClick, onTableClick]
  );

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      style={{ pointerEvents: "auto" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      aria-hidden
    />
  );
}
