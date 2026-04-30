import type { StartPairLabel } from "./bracket-render-engine";

export type MatchType = "NORMAL" | "SCOTCH";

/** A4 가로 본문 영역 — jsPDF addImage 및 캡처 루트와 동일 */
export const BRACKET_PDF_MARGIN_MM = 10;

/** 조번호 SVG 텍스트 — PDF/캡처에서 식별되도록 소폭 키움 */
const PAIR_LABEL_FONT_MM = 1.15;

const BRACKET_SVG_INSET_MM = 0.12;
const BRACKET_SVG_W = 277;
const BRACKET_SVG_H = 190;

const SLOT_NAME_FONT_MAX_MM = 2.1;
const SLOT_NAME_FONT_MIN_MM = 1.25;

/** 용지(277×190mm) 루트 기준 고정 — SVG·트리·scale 레이어와 분리 */
export function BracketPrintServiceMark() {
  return (
    <div className="bbp-print-service-mark" aria-hidden="true">
      ⓒ CAROM.CLUB
    </div>
  );
}

export type BracketSceneLike = {
  boxes: { x: number; y: number; w: number; h: number }[];
  lines: { x1: number; y1: number; x2: number; y2: number }[];
};

/**
 * 1라운드 슬롯(박스)에만 이름 표시 — 이후 라운드는 빈 칸(도형만).
 * `firstRoundNameSlots[i]` 는 scene.boxes[i] (1라운드 i번 슬롯)에 대응.
 */
export function BracketSVG({
  scene,
  matchType,
  startPairLabels = [],
  warmEmptyBoxFill = false,
  firstRoundNameSlots = null,
  firstRoundSlotToBoxIndex = null,
}: {
  scene: BracketSceneLike;
  matchType: MatchType;
  startPairLabels?: StartPairLabel[];
  warmEmptyBoxFill?: boolean;
  /** 1라운드 칸에만 표시. 길이가 1라운드 박스 개수보다 짧으면 나머지는 비움 */
  firstRoundNameSlots?: readonly (string | null | undefined)[] | null;
  /** 슬롯 i → scene.boxes 인덱스 (CENTER 등). 없으면 i 그대로 */
  firstRoundSlotToBoxIndex?: readonly number[] | null;
}) {
  const cx = BRACKET_SVG_W / 2;
  const cy = BRACKET_SVG_H / 2;
  const sx = (BRACKET_SVG_W - 2 * BRACKET_SVG_INSET_MM) / BRACKET_SVG_W;
  const sy = (BRACKET_SVG_H - 2 * BRACKET_SVG_INSET_MM) / BRACKET_SVG_H;
  const bracketInsetTransform = `translate(${cx},${cy}) scale(${sx},${sy}) translate(${-cx},${-cy})`;

  const nameLayer =
    firstRoundNameSlots != null && firstRoundNameSlots.length > 0
      ? firstRoundNameSlots.flatMap((raw, i) => {
          const boxIdx =
            firstRoundSlotToBoxIndex != null && firstRoundSlotToBoxIndex[i] !== undefined
              ? firstRoundSlotToBoxIndex[i]!
              : i;
          const b = scene.boxes[boxIdx];
          if (!b) return [];
          const label = typeof raw === "string" ? raw.trim() : "";
          if (!label) return [];
          const fs = Math.max(
            SLOT_NAME_FONT_MIN_MM,
            Math.min(SLOT_NAME_FONT_MAX_MM, b.h * 0.34),
          );
          const cxText = b.x + b.w / 2;
          const cyText = b.y + b.h / 2;
          return [
            <text
              key={`nm-${i}`}
              x={cxText}
              y={cyText}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#111111"
              fontSize={`${fs}mm`}
              fontWeight={600}
              fontFamily='system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
              style={{ paintOrder: "stroke fill", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
            >
              {label.length > 18 ? `${label.slice(0, 17)}…` : label}
            </text>,
          ];
        })
      : null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 277 190"
      style={{
        display: "block",
        width: "277mm",
        height: "190mm",
        minWidth: "277mm",
        minHeight: "190mm",
        maxWidth: "none",
        maxHeight: "none",
        background: "#ffffff",
      }}
    >
      <g transform={bracketInsetTransform}>
        {scene.lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke="#000000"
            strokeWidth={0.2}
            strokeLinecap="square"
          />
        ))}

        {scene.boxes.map((b, i) => (
          <g key={i}>
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              className={warmEmptyBoxFill ? "bbp-match-box bbp-match-box--fill" : "bbp-match-box"}
            />
            {matchType === "SCOTCH" && (
              <line
                x1={b.x + b.w / 2}
                y1={b.y}
                x2={b.x + b.w / 2}
                y2={b.y + b.h}
                stroke="#000000"
                strokeWidth={0.2}
              />
            )}
          </g>
        ))}

        {nameLayer}

        {startPairLabels.length > 0 ? (
          <g className="bbp-start-pair-labels" aria-hidden="true">
            {startPairLabels.map((t, i) => (
              <text
                key={`sp-${i}`}
                x={t.x}
                y={t.y}
                textAnchor={t.textAnchor}
                dominantBaseline="middle"
                fill="#4b5563"
                fontSize={`${PAIR_LABEL_FONT_MM}mm`}
                fontWeight={300}
                fontFamily='system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                style={{ paintOrder: "stroke fill", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}
              >
                {t.text}
              </text>
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}
