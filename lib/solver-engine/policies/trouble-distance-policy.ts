import { getPlayfieldLongSide, type PlayfieldRect } from "@/lib/billiard-table-constants";
import { ballSpeedToRailCount } from "@/lib/ball-speed-constants";
import { playableDistanceFromLongRail } from "@/lib/solver-engine/core/rail-distance-core";

/** 레일 거리 여분(5%) */
export const TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR = 1.05;

export function getTroublePlayableDistanceFromRailCount(
  rect: PlayfieldRect,
  railCount: number
): number {
  const longRailDistance = getPlayfieldLongSide(rect);
  return playableDistanceFromLongRail(
    longRailDistance,
    railCount,
    TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR
  );
}

export function troubleTotalMovableDistancePx(rect: PlayfieldRect, ballSpeed: number): number {
  const rail = ballSpeedToRailCount(ballSpeed);
  return getTroublePlayableDistanceFromRailCount(rect, rail);
}

export function getCuePlayableDistanceFromBallSpeed(rect: PlayfieldRect, ballSpeed: number): number {
  return troubleTotalMovableDistancePx(rect, ballSpeed);
}
