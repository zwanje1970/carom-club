"use client";

import React, { useRef, useEffect } from "react";
import {
  getPlayfieldRect,
  normalizedToPixel,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguSolutionData } from "@/lib/nangu-types";

const LINE_WIDTH = 2.5;
const ARROW_LENGTH = 12;
const ARROW_ANGLE_DEG = 30;

/** 해법 경로만 그리는 캔버스 (원본 테이블 위에 겹쳐 쓸 때 사용) */
export function NanguSolutionLayerCanvas({
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
  data,
  className,
}: {
  width?: number;
  height?: number;
  data: NanguSolutionData;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const rect = getPlayfieldRect(width, height);

    const cuePathColor = "rgb(239, 68, 68)";
    const objectPathColor = "rgb(125, 211, 252)";
    const drawPath = (points: { x: number; y: number }[], pathColor: string) => {
      if (points.length < 2) return;
      for (let i = 0; i < points.length - 1; i++) {
        const a = normalizedToPixel(points[i].x, points[i].y, rect);
        const b = normalizedToPixel(points[i + 1].x, points[i + 1].y, rect);
        ctx.strokeStyle = pathColor;
        ctx.lineWidth = LINE_WIDTH;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(a.px, a.py);
        ctx.lineTo(b.px, b.py);
        ctx.stroke();
        const isLast = i === points.length - 2;
        if (isLast) {
          const dx = b.px - a.px;
          const dy = b.py - a.py;
          const angle = Math.atan2(dy, dx);
          const rad = (ARROW_ANGLE_DEG * Math.PI) / 180;
          ctx.fillStyle = pathColor;
          ctx.beginPath();
          ctx.moveTo(b.px, b.py);
          ctx.lineTo(
            b.px - ARROW_LENGTH * Math.cos(angle - rad),
            b.py - ARROW_LENGTH * Math.sin(angle - rad)
          );
          ctx.lineTo(
            b.px - ARROW_LENGTH * Math.cos(angle + rad),
            b.py - ARROW_LENGTH * Math.sin(angle + rad)
          );
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    data.paths?.forEach((path) => drawPath(path.points, cuePathColor));
    if (data.reflectionPath?.points?.length) drawPath(data.reflectionPath.points, objectPathColor);
  }, [width, height, data]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className ?? "max-w-full h-auto pointer-events-none absolute inset-0"}
      aria-hidden
    />
  );
}
