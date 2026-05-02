"use client";

import type { CSSProperties } from "react";

const rowStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "stretch",
  width: "100%",
  gap: "0.5rem",
};

const btnStyle: CSSProperties = {
  minWidth: 48,
  minHeight: 44,
  height: 44,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#f8fafc",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "0 0.5rem",
  WebkitTapHighlightColor: "transparent",
};

const valueBoxStyle: CSSProperties = {
  flex: 1,
  minHeight: 44,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#fff",
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
  gap: "0.2rem",
};

const disabledBtnStyle: CSSProperties = {
  opacity: 0.4,
  cursor: "not-allowed",
};

export type NumericStepperProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  disabled?: boolean;
};

export default function NumericStepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  disabled = false,
}: NumericStepperProps) {
  const s = Number(step);
  const st = Number.isFinite(s) && s > 0 ? s : 1;
  const v = Number.isFinite(value) ? value : min;
  const atMin = v <= min;
  const atMax = v >= max;

  return (
    <div style={rowStyle} role="group" aria-label={unit ? `숫자 조절 (${unit})` : "숫자 조절"}>
      <button
        type="button"
        disabled={disabled || atMin}
        aria-label="값 줄이기"
        style={{
          ...btnStyle,
          ...(disabled || atMin ? disabledBtnStyle : {}),
        }}
        onClick={() => {
          if (disabled || atMin) return;
          onChange(Math.max(min, v - st));
        }}
      >
        －
      </button>
      <div style={valueBoxStyle} aria-live="polite">
        <span>{v}</span>
        {unit ? <span style={{ fontSize: 15, fontWeight: 600, color: "#4b5563" }}>{unit}</span> : null}
      </div>
      <button
        type="button"
        disabled={disabled || atMax}
        aria-label="값 늘리기"
        style={{
          ...btnStyle,
          ...(disabled || atMax ? disabledBtnStyle : {}),
        }}
        onClick={() => {
          if (disabled || atMax) return;
          onChange(Math.min(max, v + st));
        }}
      >
        ＋
      </button>
    </div>
  );
}
