/**
 * Formula-based bracket layout calculator (no scale/fit/transform/binary-search).
 *
 * Fixed target rectangle by default:
 * - width: 277
 * - height: 190
 *
 * Core equations (as requested):
 * - rounds = log2(N)
 * - totalLayers = 2 * rounds + 1
 * - unitH = H / totalLayers
 * - boxH = lineH = unitH
 * - halfLine = lineH / 2
 * - boxW = (W - (N - 1) * gapW) / N
 * - verify: width == W, height == H (tolerance <= 1)
 */

export type FormulaBracketStyle = "TREE_HORIZONTAL" | "TREE_VERTICAL" | "CENTER";

export type FormulaLayoutInput = {
  participants: number;
  style: FormulaBracketStyle;
  pageWidth?: number;
  pageHeight?: number;
  gapW?: number;
  centerGap?: number;
  partialLayers?: number;
  tolerance?: number;
};

export type FormulaLayoutResult = {
  N: number;
  rounds: number;
  totalLayers: number;
  unitH: number;
  boxW: number;
  boxH: number;
  gapW: number;
  lineH: number;
  halfLine: number;
  centerGap: number;
  finalWidth: number;
  finalHeight: number;
  clipped: 0 | 1;
  ok: boolean;
  partialHeight: number;
};

function isPow2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

function assertParticipants(N: number): void {
  if (!Number.isFinite(N) || N < 2 || !Number.isInteger(N) || !isPow2(N)) {
    throw new Error("participants must be an integer power of two and >= 2.");
  }
}

function calcLayers(N: number): number {
  return Math.round(Math.log2(N));
}

function calcVerticalUnit(pageHeight: number, layers: number): number {
  const totalLayers = 2 * layers + 1;
  return pageHeight / totalLayers;
}

function calcTreeWidth(N: number, pageWidth: number, gapW: number): number {
  return (pageWidth - (N - 1) * gapW) / N;
}

function calcCenterWidthBox(N: number, pageWidth: number, gapW: number, centerGap: number): number {
  const sideN = N / 2;
  const sideWidth = (pageWidth - centerGap) / 2;
  return (sideWidth - (sideN - 1) * gapW) / sideN;
}

function calcPartialHeight(boxH: number, partialLayers: number): number {
  if (!Number.isFinite(partialLayers) || partialLayers <= 0) return boxH;
  return boxH * (2 * partialLayers + 1);
}

/**
 * Main calculator for fixed formula spec.
 */
export function computeFormulaBracketLayout(input: FormulaLayoutInput): FormulaLayoutResult {
  const pageWidth = input.pageWidth ?? 277;
  const pageHeight = input.pageHeight ?? 190;
  const gapW = input.gapW ?? 0.33;
  const centerGap = input.centerGap ?? gapW;
  const tolerance = input.tolerance ?? 1;

  const N = input.participants;
  assertParticipants(N);

  const rounds = calcLayers(N);
  const totalLayers = 2 * rounds + 1;
  const unitH = calcVerticalUnit(pageHeight, rounds);
  const boxH = unitH;
  const lineH = boxH;
  const halfLine = lineH / 2;

  const boxW =
    input.style === "CENTER"
      ? calcCenterWidthBox(N, pageWidth, gapW, centerGap)
      : calcTreeWidth(N, pageWidth, gapW);

  const finalWidth =
    input.style === "CENTER"
      ? 2 * ((N / 2) * boxW + (N / 2 - 1) * gapW) + centerGap
      : N * boxW + (N - 1) * gapW;

  const finalHeight = (rounds + 1) * boxH + rounds * lineH;
  const partialHeight = calcPartialHeight(boxH, input.partialLayers ?? rounds);

  const ok = Math.abs(finalWidth - pageWidth) <= tolerance && Math.abs(finalHeight - pageHeight) <= tolerance;

  return {
    N,
    rounds,
    totalLayers,
    unitH,
    boxW,
    boxH,
    gapW,
    lineH,
    halfLine,
    centerGap,
    finalWidth,
    finalHeight,
    clipped: ok ? 0 : 1,
    ok,
    partialHeight,
  };
}

/**
 * Simple mapping for buildBracketScene-style metrics.
 * Note: This mapping is direct and formula-driven; renderer-specific geometry may impose additional constraints.
 */
export function toSceneMetrics(layout: FormulaLayoutResult): {
  boxW: number;
  boxH: number;
  boxGap: number;
  roundGap: number;
  centerGap: number;
  championGap: number;
} {
  return {
    boxW: layout.boxW,
    boxH: layout.boxH,
    boxGap: layout.lineH,
    roundGap: layout.gapW,
    centerGap: layout.centerGap,
    championGap: layout.gapW,
  };
}

/**
 * Report payload matching the requested output fields.
 */
export function toFormulaLayoutReport(layout: FormulaLayoutResult): {
  rounds: number;
  totalLayers: number;
  unitH: number;
  boxH: number;
  lineH: number;
  halfLine: number;
  finalHeight: number;
  heightOK: boolean;
} {
  return {
    rounds: layout.rounds,
    totalLayers: layout.totalLayers,
    unitH: layout.unitH,
    boxH: layout.boxH,
    lineH: layout.lineH,
    halfLine: layout.halfLine,
    finalHeight: layout.finalHeight,
    heightOK: Math.abs(layout.finalHeight - 190) <= 1,
  };
}
