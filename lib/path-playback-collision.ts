/**
 * 경로 재생 중 공-공 접촉 판정 (정규화 좌표 → 플레이필드 픽셀 거리)
 */
import {
  getBallRadius,
  getPlayfieldLongSide,
  normalizedToPixel,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NormPoint } from "@/lib/path-motion-geometry";

const TOUCH_EPS_PX = 0.85;

export function normDistancePx(a: NormPoint, b: NormPoint, rect: PlayfieldRect): number {
  const pa = normalizedToPixel(a.x, a.y, rect);
  const pb = normalizedToPixel(b.x, b.y, rect);
  return Math.hypot(pa.px - pb.px, pa.py - pb.py);
}

/** 두 공 중심 거리 < (2R - ε) 이면 접촉으로 본다 */
export function touchDiameterThresholdPx(rect: PlayfieldRect): number {
  const longSide = getPlayfieldLongSide(rect);
  return 2 * getBallRadius(longSide) - TOUCH_EPS_PX;
}

/** 수구 이동 중: 적색 1목 + (수구가 아닌) 다른 수구색 공과 접촉 */
export function cuePhaseCollisionWithOthers(
  cueNorm: NormPoint,
  placement: NanguBallPlacement,
  rect: PlayfieldRect
): boolean {
  const d = touchDiameterThresholdPx(rect);
  if (normDistancePx(cueNorm, placement.redBall, rect) < d) return true;
  if (placement.cueBall === "white") {
    if (normDistancePx(cueNorm, placement.yellowBall, rect) < d) return true;
  } else {
    if (normDistancePx(cueNorm, placement.whiteBall, rect) < d) return true;
  }
  return false;
}

/**
 * 1목(적색) 이동 중: 양 수구색과 접촉.
 * `skipMovingCueVsRed`: 충돌 직후 구간에서 적색이 아직 수구 맞춤 지점 근처일 때 오탐 방지
 */
export function objectPhaseCollisionWithOthers(
  redNorm: NormPoint,
  placement: NanguBallPlacement,
  cueEndNorm: NormPoint,
  rect: PlayfieldRect,
  skipMovingCueVsRed: boolean
): boolean {
  const d = touchDiameterThresholdPx(rect);
  const whitePos: NormPoint = placement.cueBall === "white" ? cueEndNorm : placement.whiteBall;
  const yellowPos: NormPoint = placement.cueBall === "yellow" ? cueEndNorm : placement.yellowBall;

  if (normDistancePx(redNorm, whitePos, rect) < d) {
    const movingCueIsWhite = placement.cueBall === "white";
    if (!(skipMovingCueVsRed && movingCueIsWhite)) return true;
  }
  if (normDistancePx(redNorm, yellowPos, rect) < d) {
    const movingCueIsYellow = placement.cueBall === "yellow";
    if (!(skipMovingCueVsRed && movingCueIsYellow)) return true;
  }
  return false;
}
