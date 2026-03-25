import type { BallSpeed } from "@/lib/ball-speed-constants";
import {
  clampIntegerInRange,
  clampUnitCircle,
} from "@/lib/solver-engine/core/settings-normalization";
import {
  clampRailCount,
  deriveBallSpeedFromRailCount,
} from "@/lib/solver-engine/policies/solution-settings-policy";

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
  return clampIntegerInRange(n, 0, 16);
}

function clampFine(_n: number): number {
  return 0;
}

function clampBackstroke(n: number): number {
  return clampIntegerInRange(n, 0, 6);
}

function clampFollow(n: number): number {
  return clampIntegerInRange(n, 0, 6);
}

export function clampSolutionSettings(v: SolutionSettingsValue): SolutionSettingsValue {
  const normalizedTip = clampUnitCircle(v.tipNorm);
  const railCount = clampRailCount(v.railCount ?? 3);
  return {
    cueSide: v.cueSide === "right" ? "right" : "left",
    thicknessStep: clampThicknessStep(v.thicknessStep),
    fineDx: clampFine(v.fineDx),
    fineDy: clampFine(v.fineDy),
    tipNorm: normalizedTip,
    // Distance source-of-truth is railCount; ballSpeed is derived for physics helpers.
    ballSpeed: deriveBallSpeedFromRailCount(railCount),
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
