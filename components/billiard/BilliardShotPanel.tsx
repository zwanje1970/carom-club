"use client";

/**
 * 해법 패널: 당구대 옆 세로 패널.
 * 난구풀이/해법 작성에서 두께·당점·속도·큐깊이 입력용.
 * 기존 당구노트 저장 구조는 변경하지 않고, 확장 포인트만 준비.
 */
import React, { useState } from "react";
import { getObjectBallColor, getObjectBallYellowColor } from "@/lib/billiard-table-constants";
import type { BilliardShotPanelData } from "@/lib/billiard-path-types";

export interface BilliardShotPanelProps {
  /** 1목적구 색 (빨강/노랑) - 두께 UI 색상 */
  targetBallColor?: "red" | "yellow";
  value?: Partial<BilliardShotPanelData>;
  onChange?: (data: Partial<BilliardShotPanelData>) => void;
  className?: string;
}

const SPEED_LEVELS = 5;
const STROKE_LEVELS = 5;

export function BilliardShotPanel({
  targetBallColor = "red",
  value = {},
  onChange,
  className = "",
}: BilliardShotPanelProps) {
  const thickness = value.thickness ?? 0.5;
  const tipPosition = value.tipPosition ?? { x: 0.5, y: 0.5 };
  const speedLevel = value.speedLevel ?? 3;
  const strokeDepth = value.strokeDepth ?? 3;

  const update = (patch: Partial<BilliardShotPanelData>) => {
    onChange?.({ ...value, ...patch });
  };

  return (
    <div
      className={`flex flex-col gap-4 w-48 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800/50 p-4 ${className}`}
      aria-label="해법 패널"
    >
      {/* 두께: 공 2개 확대, 수구 이동으로 겹침 표현 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          두께
        </label>
        <div className="relative h-16 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded">
          <div
            className="absolute w-10 h-10 rounded-full border-2 border-gray-400"
            style={{
              backgroundColor: targetBallColor === "red" ? getObjectBallColor() : getObjectBallYellowColor(),
              left: "20%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            className="absolute w-10 h-10 rounded-full border-2 border-gray-400 bg-white/80"
            style={{
              left: `${20 + thickness * 50}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={thickness}
            onChange={(e) => update({ thickness: e.target.valueAsNumber })}
            className="absolute bottom-0 left-2 right-2 w-[calc(100%-1rem)]"
          />
        </div>
      </div>

      {/* 당점: 공 1개 + 드래그 가능한 점 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          당점
        </label>
        <div className="relative h-20 flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded">
          <div className="w-14 h-14 rounded-full border-2 border-gray-400 bg-white/90" />
          <div
            className="absolute w-3 h-3 rounded-full bg-red-600 cursor-grab active:cursor-grabbing pointer-events-auto"
            style={{
              left: `${tipPosition.x * 100}%`,
              top: `${tipPosition.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
            role="slider"
            aria-label="당점 위치"
            tabIndex={0}
            onPointerDown={(e) => {
              e.preventDefault();
              const el = e.currentTarget;
              const parent = el.parentElement;
              if (!parent) return;
              const move = (e2: PointerEvent) => {
                const rect = parent.getBoundingClientRect();
                const x = (e2.clientX - rect.left) / rect.width;
                const y = (e2.clientY - rect.top) / rect.height;
                update({
                  tipPosition: {
                    x: Math.max(0, Math.min(1, x)),
                    y: Math.max(0, Math.min(1, y)),
                  },
                });
              };
              const up = () => {
                window.removeEventListener("pointermove", move);
                window.removeEventListener("pointerup", up);
                el.releasePointerCapture?.(e.pointerId);
              };
              el.setPointerCapture?.(e.pointerId);
              window.addEventListener("pointermove", move);
              window.addEventListener("pointerup", up);
            }}
          />
        </div>
      </div>

      {/* 속도 1~5 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          속도
        </label>
        <div className="flex items-center gap-1">
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
        <p className="text-xs text-gray-500 mt-0.5">&gt;&gt;&gt;&gt;&gt;</p>
      </div>

      {/* 큐깊이 1~5 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          큐깊이
        </label>
        <div className="flex items-center gap-1">
          {Array.from({ length: STROKE_LEVELS }, (_, i) => (
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
  );
}
