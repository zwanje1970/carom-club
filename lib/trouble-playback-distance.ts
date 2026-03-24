/**
 * 난구 재생 거리 모델
 * - 1레일 = 플레이필드 긴변 편도
 * - V = 긴변 × railCount × 여분계수
 */
import { getPlayfieldLongSide, type PlayfieldRect } from "@/lib/billiard-table-constants";
import { ballSpeedToRailCount } from "@/lib/ball-speed-constants";

/** 레일 거리 여분(5%) */
export const TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR = 1.05;

export function getTroublePlayableDistanceFromRailCount(
  rect: PlayfieldRect,
  railCount: number
): number {
  const rail = Math.max(1, Math.min(5, Math.round(Number(railCount) || 3)));
  const longRailDistance = getPlayfieldLongSide(rect);
  return longRailDistance * rail * TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR;
}

export function troubleTotalMovableDistancePx(rect: PlayfieldRect, ballSpeed: number): number {
  const rail = ballSpeedToRailCount(ballSpeed);
  return getTroublePlayableDistanceFromRailCount(rect, rail);
}

/**
 * 볼스피드(내부값) → 수구 시연 이동 가능 거리(px).
 * 내부적으로 railCount(1~5)로 환산한 뒤,
 * V = longRailDistance × railCount × 1.05
 * 1목·두께 분배와 무관 — 수구 재생 한도에만 사용.
 */
export function getCuePlayableDistanceFromBallSpeed(rect: PlayfieldRect, ballSpeed: number): number {
  return troubleTotalMovableDistancePx(rect, ballSpeed);
}
