"use client";

import { useLayoutEffect, useRef, useState } from "react";

const MIN_AUTO_SCALE = 0.12;
const MAX_AUTO_SCALE = 1.35;

/**
 * A4 가로 본문(277×190mm) 안에서 대진표 픽셀 캔버스를 비율 유지로 맞춤 — 과소 축소 하한·과대 확대 상한 적용.
 */
export default function BracketPdfScaledSheet({
  contentWidthPx,
  contentHeightPx,
  children,
  className,
}: {
  contentWidthPx: number;
  contentHeightPx: number;
  children: React.ReactNode;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const sync = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!(w > 0) || !(h > 0) || !(contentWidthPx > 0) || !(contentHeightPx > 0)) return;
      const raw = Math.min(w / contentWidthPx, h / contentHeightPx);
      const clamped = Math.max(MIN_AUTO_SCALE, Math.min(MAX_AUTO_SCALE, raw * 0.985));
      setScale(clamped);
    };
    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => ro.disconnect();
  }, [contentWidthPx, contentHeightPx]);

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: contentWidthPx,
          height: contentHeightPx,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
}
