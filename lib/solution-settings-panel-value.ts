import { normalizeBallSpeed, type BallSpeed } from "@/lib/ball-speed-constants";

export type CueSide = "left" | "right";

export type SolutionSettingsValue = {
  cueSide: CueSide;
  thicknessStep: number;
  fineDx: number;
  fineDy: number;
  tipNorm: { x: number; y: number };
  /** Internal playback speed value derived from railCount. */
  ballSpeed: BallSpeed;
  /** User-facing distance step: 1 rail .. 5 rails. */
  railCount: number;
  backstroke: number;
  followStroke: number;
  ignorePhysics: boolean;
};

export const PANEL_DEFAULT_TOUCHING_THICKNESS_STEP = 16;

export const DEFAULT_SOLUTION_SETTINGS: SolutionSettingsValue = {
  cueSide: "left",
  thicknessStep: PANEL_DEFAULT_TOUCHING_THICKNESS_STEP,
  fineDx: 0,
  fineDy: 0,
  tipNorm: { x: 0, y: 0 },
  ballSpeed: 3.0,
  railCount: 3,
  backstroke: 0,
  followStroke: 5,
  ignorePhysics: false,
};

function clampThicknessStep(n: number): number {
  return Math.max(0, Math.min(16, Math.round(n)));
}

function clampFine(_n: number): number {
  return 0;
}

function clampBackstroke(n: number): number {
  return Math.max(0, Math.min(6, Math.round(n)));
}

function clampFollow(n: number): number {
  return Math.max(0, Math.min(6, Math.round(n)));
}

function clampRailCount(n: number): number {
  return Math.max(1, Math.min(5, Math.round(Number(n) || 3)));
}

export function clampSolutionSettings(v: SolutionSettingsValue): SolutionSettingsValue {
  const tip = v.tipNorm;
  const len = Math.hypot(tip.x, tip.y);
  let nx = tip.x;
  let ny = tip.y;
  if (len > 1 && len > 1e-9) {
    nx /= len;
    ny /= len;
  }
  const railCount = clampRailCount(v.railCount ?? 3);
  return {
    cueSide: v.cueSide === "right" ? "right" : "left",
    thicknessStep: clampThicknessStep(v.thicknessStep),
    fineDx: clampFine(v.fineDx),
    fineDy: clampFine(v.fineDy),
    tipNorm: { x: nx, y: ny },
    // Distance source-of-truth is railCount; ballSpeed is derived for physics helpers.
    ballSpeed: normalizeBallSpeed(railCount),
    railCount,
    backstroke: clampBackstroke(v.backstroke),
    followStroke: clampFollow(v.followStroke),
    ignorePhysics: Boolean(v.ignorePhysics),
  };
}

export function mergeSolutionSettings(
  partial: Partial<SolutionSettingsValue>,
  base: SolutionSettingsValue
): SolutionSettingsValue {
  return clampSolutionSettings({
    ...base,
    ...partial,
    tipNorm: {
      ...base.tipNorm,
      ...(partial.tipNorm ?? {}),
    },
  });
}
