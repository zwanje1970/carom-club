"use client";

import { useState } from "react";
import { COMMON_COLOR_PALETTE_64, getCommonPaletteColorHex } from "../../../../lib/shared/common-color-palette";

type Props = {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  defaultLabel?: string;
  noneLabel?: string;
  showNoneOption?: boolean;
  presets?: Array<{ value: string; label: string; hex?: string }>;
};

export default function ColorPalettePicker({
  label,
  value,
  onChange,
  defaultLabel = "기본",
  noneLabel = "없음",
  showNoneOption = false,
  presets = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedPreset = presets.find((preset) => preset.value === value);
  const selectedColor = selectedPreset?.hex ?? getCommonPaletteColorHex(value);
  const isDefaultSelected = !value;
  const isNoneSelected = value === "none";

  return (
    <div className="v3-stack" style={{ gap: "0.35rem" }}>
      <span>{label}</span>
      <button
        type="button"
        className="v3-btn"
        onClick={() => setOpen((prev) => !prev)}
        style={{ justifyContent: "flex-start", display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <span
          style={{
            width: "1rem",
            height: "1rem",
            borderRadius: "0.2rem",
            border: "1px solid #cbd5e1",
            background: isNoneSelected ? "repeating-linear-gradient(135deg, #fff 0 3px, #fee2e2 3px 6px)" : selectedColor ?? "#ffffff",
          }}
        />
        <span>
          {isDefaultSelected ? defaultLabel : isNoneSelected ? noneLabel : selectedPreset?.label ?? "팔레트 선택됨"}
        </span>
      </button>
      {open ? (
        <div className="v3-stack" style={{ gap: "0.45rem", padding: "0.45rem", border: "1px solid #d1d5db", borderRadius: "0.45rem", background: "#fff" }}>
          <div className="v3-row" style={{ gap: "0.35rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="v3-btn"
              onClick={() => onChange(undefined)}
              style={isDefaultSelected ? { borderColor: "#2563eb", boxShadow: "0 0 0 1px #2563eb inset" } : undefined}
            >
              {defaultLabel}
            </button>
            {showNoneOption ? (
              <button
                type="button"
                className="v3-btn"
                onClick={() => onChange("none")}
                style={isNoneSelected ? { borderColor: "#2563eb", boxShadow: "0 0 0 1px #2563eb inset" } : undefined}
              >
                {noneLabel}
              </button>
            ) : null}
            {presets.map((preset) => {
              const selected = value === preset.value;
              return (
                <button
                  key={`${label}-preset-${preset.value}`}
                  type="button"
                  className="v3-btn"
                  onClick={() => onChange(preset.value)}
                  style={selected ? { borderColor: "#2563eb", boxShadow: "0 0 0 1px #2563eb inset" } : undefined}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
              gap: "0.32rem",
            }}
          >
            {COMMON_COLOR_PALETTE_64.map((color) => {
              const selected = value === color.value;
              return (
                <button
                  key={`${label}-${color.value}`}
                  type="button"
                  title={color.label}
                  onClick={() => onChange(color.value)}
                  style={{
                    width: "100%",
                    aspectRatio: "1 / 1",
                    borderRadius: "0.22rem",
                    border: selected ? "2px solid #2563eb" : "1px solid #cbd5e1",
                    background: color.hex,
                    cursor: "pointer",
                    boxShadow: selected ? "0 0 0 1px #ffffff inset" : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
