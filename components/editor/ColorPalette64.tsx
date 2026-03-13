"use client";

import { useMemo } from "react";

/** 상단: 기본/주요 색 12개 (흰, 검정, 크림, 네이비, 하늘, 주황, 회색, 노랑, 초록, 보라 등) */
const TOP_ROW: string[] = [
  "#FFFFFF",
  "#000000",
  "#F5F5DC",
  "#1e3a5f",
  "#87CEEB",
  "#FF8C00",
  "#D3D3D3",
  "#FFD700",
  "#228B22",
  "#9370DB",
  "#F5DEB3",
  "#4A4A4A",
];

/** 중간: 9개 색상족 × 5단계 (밝음→어두움) */
const MIDDLE_GRADIENT: string[][] = [
  ["#F5F5F5", "#E0E0E0", "#9E9E9E", "#616161", "#212121"], // 그레이
  ["#FFFDE7", "#FFF59D", "#F9A825", "#EF6C00", "#4E342E"], // 노랑/갈색
  ["#E3F2FD", "#90CAF9", "#2196F3", "#1565C0", "#0D47A1"], // 파랑
  ["#E1F5FE", "#B3E5FC", "#4FC3F7", "#0288D1", "#01579B"], // 하늘
  ["#FFF3E0", "#FFCC80", "#FF9800", "#E64A19", "#5D4037"], // 주황/갈색
  ["#FAFAFA", "#EEEEEE", "#BDBDBD", "#757575", "#424242"], // 따뜻한 회색
  ["#F9FBE7", "#DCE775", "#9E9D24", "#827717", "#558B2F"], // 노랑/올리브
  ["#E0F2F1", "#80CBC4", "#009688", "#00695C", "#004D40"], // 민트/틸
  ["#F3E5F5", "#CE93D8", "#9C27B0", "#6A1B9A", "#4A148C"], // 보라
];

/** 하단: 표준 밝은 색 10개 */
const BOTTOM_ROW: string[] = [
  "#000000",
  "#F44336",
  "#FF9800",
  "#FFEB3B",
  "#8BC34A",
  "#388E3C",
  "#00BCD4",
  "#2196F3",
  "#1e3a5f",
  "#9C27B0",
];

export type ColorApplyMode = "text" | "background";

export type ColorPalette64Props = {
  onSelect: (hex: string) => void;
  selectedHex?: string | null;
  applyMode: ColorApplyMode;
  cellSize?: number;
};

function normalizeHex(hex: string): string {
  const h = hex.replace(/^#/, "").toUpperCase();
  if (h.length === 3) {
    return "#" + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return "#" + h;
}

function Swatch({
  hex,
  isSelected,
  size,
  onClick,
}: {
  hex: string;
  isSelected: boolean;
  size: number;
  onClick: () => void;
}) {
  const borderColor = hex.toLowerCase() === "#ffffff" ? "#ccc" : "transparent";
  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      title={hex}
      className="rounded border-2 transition-[border-color,box-shadow] hover:border-gray-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-site-primary focus:ring-offset-1"
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        backgroundColor: hex,
        borderColor: isSelected ? "var(--site-primary)" : borderColor,
        boxShadow: isSelected ? "0 0 0 2px white, 0 0 0 4px var(--site-primary)" : undefined,
      }}
      onClick={onClick}
    />
  );
}

export function ColorPalette64({
  onSelect,
  selectedHex,
  applyMode,
  cellSize = 22,
}: ColorPalette64Props) {
  const selectedNorm = useMemo(
    () => (selectedHex ? normalizeHex(selectedHex) : null),
    [selectedHex]
  );

  const smallSize = Math.max(16, Math.min(cellSize - 4, 20)); // 중간 그리드용 약간 작게

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium text-gray-700">
        ■ 색상 · {applyMode === "text" ? "글자 색" : "배경 색"} (클릭 시 적용)
      </p>

      {/* 상단: 기본 색 12개 */}
      <div className="flex flex-wrap gap-1" role="listbox" aria-label="기본 색상">
        {TOP_ROW.map((hex, i) => (
          <Swatch
            key={`top-${i}`}
            hex={hex}
            isSelected={selectedNorm === normalizeHex(hex)}
            size={cellSize}
            onClick={() => onSelect(hex)}
          />
        ))}
      </div>

      {/* 중간: 9열 × 5행 그라데이션 (열별 밝음→어두움) */}
      <div
        className="grid shrink-0 gap-0.5"
        style={{
          gridTemplateColumns: `repeat(9, ${smallSize}px)`,
          gridTemplateRows: `repeat(5, ${smallSize}px)`,
          width: 9 * smallSize + 8 * 2,
          height: 5 * smallSize + 4 * 2,
        }}
        role="listbox"
        aria-label="색상 그라데이션"
      >
        {Array.from({ length: 5 }, (_, rowIndex) =>
          MIDDLE_GRADIENT.map((column, colIndex) => {
            const hex = column[rowIndex];
            const isSelected = selectedNorm === normalizeHex(hex);
            return (
              <Swatch
                key={`mid-${colIndex}-${rowIndex}`}
                hex={hex}
                isSelected={isSelected}
                size={smallSize}
                onClick={() => onSelect(hex)}
              />
            );
          })
        ).flat()}
      </div>

      {/* 하단: 표준 색 10개 */}
      <div className="flex flex-wrap gap-1" role="listbox" aria-label="표준 색상">
        {BOTTOM_ROW.map((hex, i) => (
          <Swatch
            key={`bot-${i}`}
            hex={hex}
            isSelected={selectedNorm === normalizeHex(hex)}
            size={cellSize}
            onClick={() => onSelect(hex)}
          />
        ))}
      </div>

      {selectedNorm && (
        <p className="text-xs font-mono text-gray-500">
          선택된 색상: <span className="text-site-text">{selectedNorm}</span>
        </p>
      )}
    </div>
  );
}
