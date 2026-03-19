"use client";

/**
 * 두께 시각 UI: 빨간 목적구 중앙 고정 + 수구 좌우 이동 + 16분할 스냅 + 겹침값 16/16~1/16 표시.
 * - 목적구: 화면 정확한 중앙, 16등분 세로선 (실선→점선 반복, 중앙 실선), 동일 선 두께.
 * - 수구: 좌우로만 이동, 수구의 좌측/우측 끝이 분할선에 닿도록 1/16 단위 스냅.
 * - 두께 = 겹치는 분할 수 / 16. 표시는 n/16만 (좌표 없음).
 * - 공 크기: 당점 UI와 동일 (nanguConstants.BALL_RADIUS_VIEWBOX_PX).
 */
import React, { useCallback, useRef, useState } from "react";
import { BALL_RADIUS_VIEWBOX_PX } from "./nanguConstants";

const W = 320;
const H = 150;
const R = BALL_RADIUS_VIEWBOX_PX;
const RED_CX = W / 2;
const RED_CY = H / 2;

/** 수구 중심 X 유효 범위 (좌우 대칭 clamp용) */
const WHITE_X_MIN = RED_CX - 2 * R + (2 * R) / 16;
const WHITE_X_MAX = RED_CX + (2 * R * 15) / 16;

const SNAP_STEPS = 16;

/** 1/16 단위로 스냅 (1..16) */
function snapN(n: number): number {
  return Math.max(1, Math.min(16, Math.round(n)));
}

/** value(0~1) → 두께 단계 n (1..16). 1 = 1/16, 16 = 16/16 */
function valueToN(value: number): number {
  const n = Math.round(value * SNAP_STEPS);
  return snapN(n || 1);
}

/** 두께 단계 n(1..16) → value */
function nToValue(n: number): number {
  return snapN(n) / SNAP_STEPS;
}

/** 스냅 가능한 흰공 중심 X 위치들: [왼쪽 15개, 중앙, 오른쪽 15개] */
function getAllSnapPositions(): { cx: number; n: number; side: -1 | 0 | 1 }[] {
  const out: { cx: number; n: number; side: -1 | 0 | 1 }[] = [];
  for (let k = 1; k <= 15; k++) {
    out.push({ cx: RED_CX - 2 * R + (2 * R * k) / 16, n: k, side: -1 });
  }
  out.push({ cx: RED_CX, n: 16, side: 0 });
  for (let k = 1; k <= 15; k++) {
    out.push({ cx: RED_CX + (2 * R * k) / 16, n: 16 - k, side: 1 });
  }
  return out;
}

const SNAP_POSITIONS = getAllSnapPositions();

/** 픽셀 X → 가장 가까운 스냅 (value, side) */
function pxToSnap(px: number): { value: number; side: -1 | 0 | 1 } {
  let best = SNAP_POSITIONS[0];
  let bestDist = Math.abs(px - best.cx);
  for (let i = 1; i < SNAP_POSITIONS.length; i++) {
    const d = Math.abs(px - SNAP_POSITIONS[i].cx);
    if (d < bestDist) {
      bestDist = d;
      best = SNAP_POSITIONS[i];
    }
  }
  return { value: nToValue(best.n), side: best.side };
}

/** value + side → 흰공 중심 X */
function valueAndSideToWhiteCx(value: number, side: -1 | 0 | 1): number {
  const n = valueToN(value);
  if (n === 16) return RED_CX;
  const step = 16 - n;
  if (side <= 0) return RED_CX - (2 * R * step) / 16;
  return RED_CX + (2 * R * step) / 16;
}

/** 두께 값(0~1)으로 겹침 여부. 뱅크샷 비활성화 판단용 */
export function getThicknessOverlap(value: number): boolean {
  const n = valueToN(value);
  return n >= 1;
}

/** 표시용: n/16 문자열만 (좌표 없음) */
function valueToFractionLabel(value: number): string {
  const n = valueToN(value);
  return `${n}/16`;
}

export interface NanguThicknessEditorProps {
  value: number;
  isBankShot: boolean;
  onChange: (value: number) => void;
  onBankShotChange: (v: boolean) => void;
  onFocusZoomRequest?: (clientX: number, clientY: number) => void;
  onFocusZoomEnd?: () => void;
  className?: string;
}

export function NanguThicknessEditor({
  value,
  isBankShot,
  onChange,
  onBankShotChange,
  onFocusZoomRequest,
  onFocusZoomEnd,
  className,
}: NanguThicknessEditorProps) {
  const n = valueToN(value);
  const [lastSide, setLastSide] = useState<-1 | 0 | 1>(0);
  const whiteCx = valueAndSideToWhiteCx(value, lastSide);
  const overlap = getThicknessOverlap(value);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  const clientToLocal = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const scale = Math.min(rect.width / W, rect.height / H);
    const offsetX = (rect.width - W * scale) * 0.5;
    const offsetY = (rect.height - H * scale) * 0.5;
    const xRaw = (clientX - rect.left - offsetX) / scale;
    const yRaw = (clientY - rect.top - offsetY) / scale;
    const x = Math.max(WHITE_X_MIN, Math.min(WHITE_X_MAX, xRaw));
    const y = Math.max(0, Math.min(H, yRaw));
    return { x, y };
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const local = clientToLocal(e.clientX, e.clientY);
      if (!local) return;
      const dx = local.x - whiteCx;
      const dy = local.y - RED_CY;
      if (dx * dx + dy * dy <= R * R) {
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onFocusZoomRequest?.(e.clientX, e.clientY);
      }
    },
    [whiteCx, clientToLocal, onFocusZoomRequest]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const local = clientToLocal(e.clientX, e.clientY);
      if (!local) return;
      const { value: newVal, side } = pxToSnap(local.x);
      setLastSide(side);
      onChange(newVal);
      if (getThicknessOverlap(newVal) && isBankShot) onBankShotChange(false);
    },
    [dragging, clientToLocal, onChange, isBankShot, onBankShotChange]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDragging(false);
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      onFocusZoomEnd?.();
    },
    [onFocusZoomEnd]
  );

  return (
    <div className={className}>
      <p className="text-sm font-medium text-site-text mb-1.5">
        두께 <span className="text-site-primary font-semibold">{valueToFractionLabel(value)}</span>
      </p>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="touch-none select-none"
        style={{ maxHeight: 180, aspectRatio: `${W} / ${H}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <radialGradient id="red-ball-gradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#e53e3e" />
            <stop offset="70%" stopColor="#c53030" />
            <stop offset="100%" stopColor="#9b2c2c" />
          </radialGradient>
          <radialGradient id="white-ball-highlight" cx="35%" cy="35%" r="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.9)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <filter id="white-ball-shadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodColor="#000" floodOpacity="0.12" />
          </filter>
          <filter id="ball-border-glow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="0" stdDeviation="0.8" floodColor="#fff" floodOpacity="0.4" />
          </filter>
        </defs>

        {/* 목적구: 화면 중앙 고정, 16등분 세로선 (실선→점선 반복, 중앙 실선) */}
        <g>
          <circle
            cx={RED_CX}
            cy={RED_CY}
            r={R}
            fill="url(#red-ball-gradient)"
            stroke="#f8fafc"
            strokeWidth={2.5}
            strokeOpacity={0.95}
            filter="url(#ball-border-glow)"
          />
          {Array.from({ length: 17 }, (_, k) => {
            const x = RED_CX - R + (2 * R * k) / 16;
            const dx = x - RED_CX;
            const halfHeight = Math.sqrt(Math.max(0, R * R - dx * dx));
            const y1 = RED_CY - halfHeight;
            const y2 = RED_CY + halfHeight;
            const isCenter = k === 8;
            const isDashed = !isCenter && k % 2 === 1;
            return (
              <line
                key={k}
                x1={x}
                y1={y1}
                x2={x}
                y2={y2}
                stroke="#ffffff"
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray={isDashed ? "2 2" : undefined}
              />
            );
          })}
        </g>

        {/* 수구: 좌우 스냅 이동만 (테두리 명확한 경계선) */}
        <circle
          cx={whiteCx}
          cy={RED_CY}
          r={R}
          fill="#f7fafc"
          fillOpacity={0.7}
          stroke="#f8fafc"
          strokeWidth={2.5}
          strokeOpacity={0.95}
          filter="url(#white-ball-shadow)"
        />
        <circle
          cx={whiteCx}
          cy={RED_CY}
          r={R}
          fill="url(#white-ball-highlight)"
          fillOpacity={0.4}
          stroke="none"
        />
      </svg>
      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
        흰공을 드래그하면 분할선에 맞춰 스냅됩니다. 겹침이 많을수록 두껍습니다.
      </p>
      <label className="mt-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={isBankShot}
          disabled={overlap}
          onChange={(e) => onBankShotChange(e.target.checked)}
        />
        <span className={`text-sm ${overlap ? "text-gray-400 dark:text-slate-500" : "text-site-text"}`}>
          뱅크샷 (두 공이 겹치지 않을 때만)
        </span>
      </label>
      {overlap && isBankShot && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">겹침이 있으면 뱅크샷이 해제됩니다.</p>
      )}
    </div>
  );
}
