"use client";

/**
 * 배치 미리보기 위 투명 히트 레이어 — 캔버스/SVG가 클릭을 가로채지 않게 하고,
 * 짧은 탭만 전체화면 진입, 임계값 이상 이동은 드래그로 간주해 무시.
 */
import React, { useRef, useCallback } from "react";

const TAP_MAX_MOVE_PX = 5;

export type NanguTablePreviewHitLayerProps = {
  onOpen: () => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
  /** Trouble 콘솔 계약용 (히트 레이어가 실제 클릭 타겟) */
  dataTroubleRegion?: string;
};

export function NanguTablePreviewHitLayer({
  onOpen,
  disabled = false,
  className = "",
  ariaLabel,
  dataTroubleRegion,
}: NanguTablePreviewHitLayerProps) {
  const gestureRef = useRef<{ x: number; y: number; id: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.button !== 0) return;
      gestureRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [disabled]
  );

  const finish = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, allowOpen: boolean) => {
      const start = gestureRef.current;
      gestureRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
      if (disabled || !allowOpen || !start || start.id !== e.pointerId) return;
      const d = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (d <= TAP_MAX_MOVE_PX) onOpen();
    },
    [disabled, onOpen]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finish(e, true);
    },
    [finish]
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finish(e, false);
    },
    [finish]
  );

  const onLostPointerCapture = useCallback(() => {
    gestureRef.current = null;
  }, []);

  return (
    <div
      {...(dataTroubleRegion ? { "data-trouble-region": dataTroubleRegion } : {})}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={ariaLabel}
      className={`select-none ${disabled ? "pointer-events-none cursor-not-allowed" : ""} ${className}`}
      style={{ touchAction: "manipulation" }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    />
  );
}
