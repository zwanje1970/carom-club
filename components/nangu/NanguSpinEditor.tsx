"use client";

/**
 * 당점 UI: 12분할 유지 + 12/24/36/48 동심원 + 이동 제한 36mm + 좌표 표시 없음.
 * - 공 지름 61.5mm, 공 중심 기준. (nanguConstants와 동일 스케일)
 * - 동심원: 12mm, 24mm, 36mm(이동 한계), 48mm(가이드) + 공 외곽 61.5mm.
 * - 당점 원 지름 12mm. 당점 중심 최대 반지름 36mm.
 */
import React, { useCallback, useRef, useState } from "react";
import { BALL_RADIUS_MM, BALL_RADIUS_VIEWBOX_PX } from "./nanguConstants";

const SIZE = 160;
const CX = SIZE / 2;
const CY = SIZE / 2;

/** 공 반지름(px) - 두께 UI와 동일 값 사용 */
const BALL_RADIUS_PX = BALL_RADIUS_VIEWBOX_PX;
const PX_PER_MM = BALL_RADIUS_PX / BALL_RADIUS_MM; // 74 / 30.75

/** 동심원 반지름 (mm) → px: 12, 24, 36, 48 (지름 기준 반지름) */
const R_6_PX = 6 * PX_PER_MM;   // 지름 12mm
const R_12_PX = 12 * PX_PER_MM; // 지름 24mm
const R_18_PX = 18 * PX_PER_MM; // 지름 36mm (이동 한계)
const R_24_PX = 24 * PX_PER_MM; // 지름 48mm (참고 가이드)

/** 당점 이동 최대 반지름 = 36mm */
const MAX_TIP_R_MM = 36;
const MAX_TIP_R_PX = MAX_TIP_R_MM * PX_PER_MM;

/** 당점 마커 반지름: 지름 12mm → 6mm */
const TIP_MARKER_R_PX = 6 * PX_PER_MM;

/** 터치 위치를 36mm 반지름 안으로 clamp */
function clampTo36mm(px: number, py: number): { x: number; y: number } {
  const dx = px - CX;
  const dy = py - CY;
  const d = Math.hypot(dx, dy) || 1e-6;
  if (d <= MAX_TIP_R_PX) return { x: px, y: py };
  const scale = MAX_TIP_R_PX / d;
  return { x: CX + dx * scale, y: CY + dy * scale };
}

function pixelToSpin(px: number, py: number): { spinX: number; spinY: number } {
  const clamped = clampTo36mm(px, py);
  const spinX = (clamped.x - CX) / MAX_TIP_R_PX;
  const spinY = (clamped.y - CY) / MAX_TIP_R_PX;
  return { spinX, spinY };
}

function spinToPixel(spinX: number, spinY: number): { px: number; py: number } {
  const r = Math.hypot(spinX, spinY) || 1e-6;
  const scale = Math.min(1, r);
  return {
    px: CX + (spinX / r) * MAX_TIP_R_PX * scale,
    py: CY + (spinY / r) * MAX_TIP_R_PX * scale,
  };
}

/** 12시 = 0°, 시계방향 30° 간격 (분할 직선 유지) */
function clockAngleToXY(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

export interface NanguSpinEditorProps {
  spinX: number;
  spinY: number;
  onChange: (value: { spinX: number; spinY: number }) => void;
  onFocusZoomRequest?: (clientX: number, clientY: number) => void;
  onFocusZoomEnd?: () => void;
  className?: string;
}

export function NanguSpinEditor({
  spinX,
  spinY,
  onChange,
  onFocusZoomRequest,
  onFocusZoomEnd,
  className,
}: NanguSpinEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const clientToLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = (clientX - rect.left) * (SIZE / rect.width);
    const y = (clientY - rect.top) * (SIZE / rect.height);
    return { x, y };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const local = clientToLocal(e.clientX, e.clientY);
      if (!local) return;
      const { spinX: sx, spinY: sy } = pixelToSpin(local.x, local.y);
      onChange({ spinX: sx, spinY: sy });
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onFocusZoomRequest?.(e.clientX, e.clientY);
    },
    [clientToLocal, onChange, onFocusZoomRequest]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const local = clientToLocal(e.clientX, e.clientY);
      if (!local) return;
      const { spinX: sx, spinY: sy } = pixelToSpin(local.x, local.y);
      onChange({ spinX: sx, spinY: sy });
    },
    [dragging, clientToLocal, onChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onFocusZoomEnd?.();
    },
    [onFocusZoomEnd]
  );

  const tip = spinToPixel(spinX, spinY);
  const rayAngles = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

  return (
    <div className={className}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="touch-none select-none rounded-full border border-gray-200 dark:border-slate-600"
        style={{ maxWidth: SIZE, aspectRatio: "1" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <filter id="spin-ball-border-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#fff" floodOpacity="0.35" />
          </filter>
        </defs>
        {/* 6) 공 외곽 (61.5mm) - 명확한 경계선 */}
        <circle
          cx={CX}
          cy={CY}
          r={BALL_RADIUS_PX}
          fill="transparent"
          stroke="#f8fafc"
          strokeWidth={2.5}
          strokeOpacity={0.9}
          filter="url(#spin-ball-border-glow)"
        />

        {/* 2) 12mm 3) 24mm 4) 36mm(이동 한계) 5) 48mm(가이드) 동심원 */}
        <circle cx={CX} cy={CY} r={R_6_PX} fill="none" stroke="#d1d5db" strokeWidth={0.8} />
        <circle cx={CX} cy={CY} r={R_12_PX} fill="none" stroke="#d1d5db" strokeWidth={0.8} />
        <circle cx={CX} cy={CY} r={R_18_PX} fill="none" stroke="#d1d5db" strokeWidth={0.8} />
        <circle cx={CX} cy={CY} r={R_24_PX} fill="none" stroke="#d1d5db" strokeWidth={0.8} />

        {/* 1) 중심점 */}
        <circle cx={CX} cy={CY} r={1.2} fill="#9ca3af" />

        {/* 12분할 방사형 선 (12시 기준 시계 방향) */}
        {rayAngles.map((deg) => {
          const { x, y } = clockAngleToXY(deg);
          return (
            <line
              key={deg}
              x1={CX}
              y1={CY}
              x2={CX + BALL_RADIUS_PX * x}
              y2={CY + BALL_RADIUS_PX * y}
              stroke="#d1d5db"
              strokeWidth={0.8}
            />
          );
        })}

        {/* 당점 마커: 지름 12mm, 빨간 원 (명확한 테두리) */}
        <circle
          cx={tip.px}
          cy={tip.py}
          r={TIP_MARKER_R_PX}
          fill="#dc2626"
          stroke="#fef2f2"
          strokeWidth={2}
          strokeOpacity={0.95}
        />
      </svg>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
        당점은 반지름 36mm 안에서만 이동합니다. 12시 방향 + 거리(12/24/36/48mm)를 참고하세요.
      </p>
    </div>
  );
}
