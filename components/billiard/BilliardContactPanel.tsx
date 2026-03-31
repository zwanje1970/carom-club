"use client";

/**
 * 두께 + 당점 통합 패널 (해법 설명용).
 * 공 2개(비수구 1개는 무대 중심에 고정, 수구만 이동)가 겹치는 하나의 화면에서
 * 두께(수구 위치)와 당점(수구 위 빨간 점)을 동시에 조정.
 */
import React, { useRef, useEffect, useCallback, useState } from "react";
import { getCueBallColor, getObjectBallColor, getObjectBallYellowColor } from "@/lib/billiard-table-constants";
import type { BilliardContactPanelData } from "@/lib/billiard-path-types";

const STAGE_SIZE = 260;
const BALL_R = 50;
const CENTER = STAGE_SIZE / 2;
/** 수구 오프셋 범위 (픽셀). 이 안에서만 수구 이동 */
const OFFSET_MAX = 55;
const TIP_DOT_R = 10;
const TIP_HIT_R = 22;

const DIRECTIONS = [
  "12시",
  "1시",
  "3시",
  "5시",
  "6시",
  "7시",
  "9시",
  "11시",
];
const SPEED_LEVELS = 5;
const DEPTH_LEVELS = 5;

export interface BilliardContactPanelProps {
  /** 미니 다이어그램에서 중심에 그릴 비수구의 색 키(red | yellow). first object ball 역할 고정 아님 */
  objectBallColor?: "red" | "yellow";
  /** 수구 색: white | yellow (선택된 수구 기준) */
  cueBallColor?: "white" | "yellow";
  value?: Partial<BilliardContactPanelData>;
  onChange?: (data: Partial<BilliardContactPanelData>) => void;
  className?: string;
}

function clampTipToCircle(
  x: number,
  y: number
): { x: number; y: number } {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= 0.5) return { x, y };
  const scale = 0.5 / d;
  return { x: 0.5 + dx * scale, y: 0.5 + dy * scale };
}

export function BilliardContactPanel({
  objectBallColor = "red",
  cueBallColor = "white",
  value = {},
  onChange,
  className = "",
}: BilliardContactPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState<"cue" | "tip" | null>(null);

  const thicknessPosition = value.thicknessPosition ?? { x: 0.5, y: 0.5 };
  const tipPosition = value.tipPosition ?? { x: 0.5, y: 0.3 };
  const directionLabel = value.directionLabel ?? "";
  const tipCount = value.tipCount ?? 1;
  const speedLevel = value.speedLevel ?? 3;
  const strokeDepth = value.strokeDepth ?? 3;

  const cueDx = (thicknessPosition.x - 0.5) * 2 * OFFSET_MAX;
  const cueDy = (thicknessPosition.y - 0.5) * 2 * OFFSET_MAX;
  const cueCx = CENTER + cueDx;
  const cueCy = CENTER + cueDy;

  const tipPx = cueCx + (tipPosition.x - 0.5) * 2 * BALL_R;
  const tipPy = cueCy + (tipPosition.y - 0.5) * 2 * BALL_R;

  const update = useCallback(
    (patch: Partial<BilliardContactPanelData>) => {
      onChange?.({ ...value, ...patch });
    },
    [value, onChange]
  );

  const getStageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const scale = STAGE_SIZE / rect.width;
      return {
        x: (clientX - rect.left) * scale,
        y: (clientY - rect.top) * scale,
      };
    },
    []
  );

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, STAGE_SIZE, STAGE_SIZE);

    const objColor = objectBallColor === "red" ? getObjectBallColor() : getObjectBallYellowColor();
    const cueColor = getCueBallColor(cueBallColor);

    // 보조선 (중심 기준선)
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(CENTER, 0);
    ctx.lineTo(CENTER, STAGE_SIZE);
    ctx.moveTo(0, CENTER);
    ctx.lineTo(STAGE_SIZE, CENTER);
    ctx.stroke();
    ctx.setLineDash([]);

    // 비수구(중심 고정) — 색은 objectBallColor
    ctx.fillStyle = objColor;
    ctx.beginPath();
    ctx.arc(CENTER, CENTER, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 수구 (반투명, 이동 가능)
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = cueColor;
    ctx.beginPath();
    ctx.arc(cueCx, cueCy, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // 당점 점 (수구 위)
    ctx.fillStyle = "#c41e3a";
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(tipPx, tipPy, TIP_DOT_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }, [
    objectBallColor,
    cueBallColor,
    cueCx,
    cueCy,
    tipPx,
    tipPy,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const coords = getStageCoords(e.clientX, e.clientY);
      if (!coords) return;
      const distToTip = Math.hypot(coords.x - tipPx, coords.y - tipPy);
      const distToCue = Math.hypot(coords.x - cueCx, coords.y - cueCy);
      if (distToTip <= TIP_HIT_R) {
        e.preventDefault();
        setDragging("tip");
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      } else if (distToCue <= BALL_R) {
        e.preventDefault();
        setDragging("cue");
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    },
    [getStageCoords, tipPx, tipPy, cueCx, cueCy]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const coords = getStageCoords(e.clientX, e.clientY);
      if (!coords || !dragging) return;

      if (dragging === "tip") {
        const nx = (coords.x - cueCx) / (2 * BALL_R) + 0.5;
        const ny = (coords.y - cueCy) / (2 * BALL_R) + 0.5;
        const clamped = clampTipToCircle(nx, ny);
        update({ tipPosition: clamped });
      } else {
        const dx = coords.x - CENTER;
        const dy = coords.y - CENTER;
        const dist = Math.hypot(dx, dy);
        const clamp = Math.min(dist, OFFSET_MAX);
        const ax = dist > 0 ? (dx / dist) * clamp : 0;
        const ay = dist > 0 ? (dy / dist) * clamp : 0;
        const tx = ax / (2 * OFFSET_MAX) + 0.5;
        const ty = ay / (2 * OFFSET_MAX) + 0.5;
        update({
          thicknessPosition: {
            x: Math.max(0, Math.min(1, tx)),
            y: Math.max(0, Math.min(1, ty)),
          },
        });
      }
    },
    [dragging, getStageCoords, cueCx, cueCy, update]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        setDragging(null);
      }
    },
    [dragging]
  );

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4 ${className}`}
      aria-label="두께·당점 통합 패널"
    >
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* 통합 영역: 공 2개 + 당점 점 */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            두께 · 당점
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            수구를 드래그해 두께, 빨간 점을 드래그해 당점을 맞춥니다.
          </p>
          <div
            className="rounded-lg overflow-hidden bg-gray-900 flex justify-center items-center"
            style={{ width: STAGE_SIZE, height: STAGE_SIZE, maxWidth: "100%" }}
          >
            <canvas
              ref={canvasRef}
              width={STAGE_SIZE}
              height={STAGE_SIZE}
              className="max-w-full h-auto touch-none cursor-crosshair"
              style={{ width: "100%", height: "auto", aspectRatio: "1" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              aria-label="두께·당점 조정"
            />
          </div>
        </div>

        {/* 옆 정보: 방향, 팁 수, 속도, 깊이 */}
        <div className="flex flex-col gap-3 min-w-[140px]">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              방향
            </label>
            <select
              value={directionLabel}
              onChange={(e) => update({ directionLabel: e.target.value })}
              className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5"
            >
              <option value="">선택</option>
              {DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} 방향
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              팁 수
            </label>
            <input
              type="number"
              min={1}
              max={9}
              value={tipCount}
              onChange={(e) =>
                update({ tipCount: Math.max(1, Math.min(9, e.target.valueAsNumber || 1)) })
              }
              className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              속도
            </label>
            <div className="flex gap-1">
              {Array.from({ length: SPEED_LEVELS }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => update({ speedLevel: i + 1 })}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    speedLevel >= i + 1
                      ? "bg-site-primary text-white"
                      : "bg-gray-200 dark:bg-slate-600 text-gray-500"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              깊이
            </label>
            <div className="flex gap-1">
              {Array.from({ length: DEPTH_LEVELS }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => update({ strokeDepth: i + 1 })}
                  className={`flex-1 py-1 rounded text-xs font-medium ${
                    strokeDepth >= i + 1
                      ? "bg-site-primary text-white"
                      : "bg-gray-200 dark:bg-slate-600 text-gray-500"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
