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

export type CuePhaseCollisionOptions = {
  /**
   * 시각화 재생: 수구→첫 스팟 광선상 **의도된 1목**과 맞닿는 순간은 경로 끝으로 정상 — 충돌 팝업 제외
   */
  ignoreTouchingBallKeys?: readonly ("red" | "yellow" | "white")[];
};

/** 수구 이동 중: 수구가 아닌 두 목적 후보 공 + (고정된) 다른 수구색 공과 접촉 */
export function cuePhaseCollisionWithOthers(
  cueNorm: NormPoint,
  placement: NanguBallPlacement,
  rect: PlayfieldRect,
  options?: CuePhaseCollisionOptions
): boolean {
  const d = touchDiameterThresholdPx(rect);
  const skip = new Set(options?.ignoreTouchingBallKeys ?? []);
  if (!skip.has("red") && normDistancePx(cueNorm, placement.redBall, rect) < d) return true;
  if (placement.cueBall === "white") {
    if (!skip.has("yellow") && normDistancePx(cueNorm, placement.yellowBall, rect) < d) return true;
  } else {
    if (!skip.has("white") && normDistancePx(cueNorm, placement.whiteBall, rect) < d) return true;
  }
  return false;
}

/**
 * 1목(수구 제외 2구 중 실제 맞은 공) 이동 중: 나머지 두 공(수구 끝 위치 + 제3구)과 접촉.
 * `skipEarlyVsCue`: 충돌 직후 구간에서 맞은 공이 수구 맞춤 지점 근처일 때 오탐 방지
 */
export function objectPhaseCollisionWithOthers(
  movingObjectNorm: NormPoint,
  movingBallKey: "red" | "yellow" | "white",
  placement: NanguBallPlacement,
  cueEndNorm: NormPoint,
  rect: PlayfieldRect,
  skipEarlyVsCue: boolean,
  progress01: number
): boolean {
  const d = touchDiameterThresholdPx(rect);
  const OBJECT_PHASE_SKIP_UNTIL_T = 0.12;

  for (const key of ["red", "yellow", "white"] as const) {
    if (key === movingBallKey) continue;
    const other: NormPoint =
      key === placement.cueBall
        ? cueEndNorm
        : key === "red"
          ? placement.redBall
          : key === "yellow"
            ? placement.yellowBall
            : placement.whiteBall;
    if (normDistancePx(movingObjectNorm, other, rect) < d) {
      const otherIsCue = key === placement.cueBall;
      if (otherIsCue && skipEarlyVsCue && progress01 < OBJECT_PHASE_SKIP_UNTIL_T) continue;
      return true;
    }
  }
  return false;
}
