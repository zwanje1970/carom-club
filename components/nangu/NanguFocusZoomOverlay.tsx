"use client";

/**
 * 포커스 확대 오버레이: 터치한 UI를 1.5~2배 확대해 표시.
 * 주변은 어둡게, 손을 떼면 제거. 모바일 정밀 조작용.
 */
import React, { useEffect } from "react";

const ZOOM_SCALE = 1.8;

export type NanguFocusZoomTarget =
  | "thickness"
  | "spin"
  | "backstroke"
  | "followstroke"
  | "speed"
  | "path"
  | null;

export interface NanguFocusZoomOverlayProps {
  active: boolean;
  target: NanguFocusZoomTarget;
  originX: number;
  originY: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function NanguFocusZoomOverlay({
  active,
  target,
  originX,
  originY,
  onClose,
  children,
}: NanguFocusZoomOverlayProps) {
  useEffect(() => {
    if (!active) return;
    const up = () => onClose();
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [active, onClose]);

  if (!active || !target) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.28)" }}
      aria-label="확대 조작 영역"
      onPointerUp={onClose}
    >
      <div
        className="rounded-2xl bg-white dark:bg-slate-800 shadow-xl overflow-hidden max-w-[min(100vw,360px)]"
        style={{
          transform: `scale(${ZOOM_SCALE})`,
          transformOrigin: "center center",
        }}
        onPointerUp={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
