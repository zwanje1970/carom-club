"use client";

import { useMemo } from "react";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, NanguSolutionData } from "@/lib/nangu-types";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  sampleCueMotion,
  sampleObjectMotion,
  type PathMotionPlan,
  type PositionAlongPathResult,
} from "@/lib/solution-path-motion";

export type { PathMotionPlan, PositionAlongPathResult };

/**
 * 수구: 해법 경로 위에서만 이동. progress01 0→1 이 스트로크 진행.
 * `PathMotionPlan.animationDurationMs` / `animationDurationSec`는 세기 레일 기준 튜닝값(`PATH_ANIMATION_TIMING`).
 */
export function useCuePathMotionPosition(
  placement: NanguBallPlacement | null,
  data: NanguSolutionData | null,
  progress01: number,
  width: number = DEFAULT_TABLE_WIDTH,
  height: number = DEFAULT_TABLE_HEIGHT
): PositionAlongPathResult | null {
  const rect = useMemo(() => getPlayfieldRect(width, height), [width, height]);
  return useMemo(() => {
    if (!placement || !data) return null;
    const plan = buildCuePathMotionPlan(placement, data, rect);
    if (!plan) return null;
    return sampleCueMotion(plan, progress01, rect);
  }, [placement, data, progress01, rect]);
}

export function useCuePathMotionPlan(
  placement: NanguBallPlacement | null,
  data: NanguSolutionData | null,
  width: number = DEFAULT_TABLE_WIDTH,
  height: number = DEFAULT_TABLE_HEIGHT
): PathMotionPlan | null {
  const rect = useMemo(() => getPlayfieldRect(width, height), [width, height]);
  return useMemo(() => {
    if (!placement || !data) return null;
    return buildCuePathMotionPlan(placement, data, rect);
  }, [placement, data, rect]);
}

/**
 * 1목 경로 (reflectionPath)
 */
export function useObjectPathMotionPosition(
  data: NanguSolutionData | null,
  progress01: number,
  width: number = DEFAULT_TABLE_WIDTH,
  height: number = DEFAULT_TABLE_HEIGHT
): PositionAlongPathResult | null {
  const rect = useMemo(() => getPlayfieldRect(width, height), [width, height]);
  return useMemo(() => {
    if (!data) return null;
    const plan = buildObjectPathMotionPlan(data, rect);
    if (!plan) return null;
    return sampleObjectMotion(plan, progress01, rect);
  }, [data, progress01, rect]);
}
