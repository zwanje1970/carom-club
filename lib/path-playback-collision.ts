/**
 * 경로 재생 중 공-공 접촉 판정 (정규화 좌표 → 플레이필드 픽셀 거리)
 *
 * 설계: **겹침은 허용하지 않음**. 원둘레가 맞닿는 정도(중심거리 ≈ 2R)이면 접촉으로 본다.
 * 1목: **첫 스팟 접촉** 구간(`cuePathProgress01 < warnReContactAfterProgress`)은 충돌이 아님.
 * 그 이후 수구↔1목 맞닿음은 **수구·1목 경로 폴리라인이 공선으로 겹치는 구간**에 있을 때만 충돌 경고.
 * **재생 시작 시** 이미 맞닿아 있던 쌍(`collectInitialTouchingBallPairs`)은 재생 중 맞닿아도 충돌로 보지 않음.
 */
import {
  getBallRadius,
  getPlayfieldLongSide,
  normalizedToPixel,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import {
  polylineSegmentIndexAtDistancePx,
  polylineSegmentLengthsPx,
  type NormPoint,
} from "@/lib/path-motion-geometry";

/** 부동소수·픽셀 양자화 보정: `≤ 2R + ε` 이면 맞닿음으로 간주 */
const CONTACT_EPS_PX = 1.5;

/** 수구 세그먼트 vs 1목 세그먼트 공선 판정 — 끝점이 동일 직선에서 벗어나면 겹침 아님 */
const PATH_SEGMENT_COLINEAR_EPS_PX = 2.8;
/** 공선일 때 겹쳐야 하는 최소 구간 길이(px) — 점 접촉만으로는 경로 겹침으로 보지 않음 */
const PATH_SEGMENT_MIN_OVERLAP_PX = 3;

function segmentColinearOverlapLengthPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lab = Math.hypot(abx, aby);
  if (lab < 1e-6) return 0;
  const ux = abx / lab;
  const uy = aby / lab;
  const nx = -uy;
  const ny = ux;
  const distC = Math.abs((cx - ax) * nx + (cy - ay) * ny);
  const distD = Math.abs((dx - ax) * nx + (dy - ay) * ny);
  if (distC > PATH_SEGMENT_COLINEAR_EPS_PX || distD > PATH_SEGMENT_COLINEAR_EPS_PX) return 0;
  const tA1 = lab;
  const tC = (cx - ax) * ux + (cy - ay) * uy;
  const tD = (dx - ax) * ux + (dy - ay) * uy;
  const c0 = Math.min(tC, tD);
  const c1 = Math.max(tC, tD);
  return Math.max(0, Math.min(tA1, c1) - Math.max(0, c0));
}

/**
 * 수구가 dCue 지점에 있을 때, 해당 수구 폴리라인 세그먼트가 1목 폴리라인의 어느 세그먼트와
 * 공선으로 최소 길이 이상 겹치는지 (의도된 첫 스팟 접촉 이후 재접촉 경고용).
 */
export function cuePathOverlapsObjectPathAtCueDistancePx(
  cueVertices: NormPoint[],
  cueDistancePx: number,
  objectVertices: NormPoint[],
  rect: PlayfieldRect,
  minOverlapPx: number = PATH_SEGMENT_MIN_OVERLAP_PX
): boolean {
  if (cueVertices.length < 2 || objectVertices.length < 2) return false;
  const i = polylineSegmentIndexAtDistancePx(cueVertices, cueDistancePx, rect);
  const ca = cueVertices[i]!;
  const cb = cueVertices[i + 1]!;
  const p0 = normalizedToPixel(ca.x, ca.y, rect);
  const p1 = normalizedToPixel(cb.x, cb.y, rect);
  for (let j = 0; j < objectVertices.length - 1; j++) {
    const oa = objectVertices[j]!;
    const ob = objectVertices[j + 1]!;
    const q0 = normalizedToPixel(oa.x, oa.y, rect);
    const q1 = normalizedToPixel(ob.x, ob.y, rect);
    const ov = segmentColinearOverlapLengthPx(p0.px, p0.py, p1.px, p1.py, q0.px, q0.py, q1.px, q1.py);
    if (ov >= minOverlapPx) return true;
  }
  return false;
}

export function normDistancePx(a: NormPoint, b: NormPoint, rect: PlayfieldRect): number {
  const pa = normalizedToPixel(a.x, a.y, rect);
  const pb = normalizedToPixel(b.x, b.y, rect);
  return Math.hypot(pa.px - pb.px, pa.py - pb.py);
}

/** 두 공 중심 거리가 원둘레가 맞닿을 때(≈2R) 이하이면 true — 겹침(2R 미만) 포함 */
export function areBallCentersTouchingOrCloser(a: NormPoint, b: NormPoint, rect: PlayfieldRect): boolean {
  const d = normDistancePx(a, b, rect);
  const longSide = getPlayfieldLongSide(rect);
  const twoR = 2 * getBallRadius(longSide);
  return d <= twoR + CONTACT_EPS_PX;
}

/** @deprecated {@link areBallCentersTouchingOrCloser} 사용. 과거: 2R−ε 미만만 잡아 맞닿음을 놓칠 수 있었음 */
export function touchDiameterThresholdPx(rect: PlayfieldRect): number {
  const longSide = getPlayfieldLongSide(rect);
  return 2 * getBallRadius(longSide) + CONTACT_EPS_PX;
}

/** 정렬된 키 — 재생 시작 시점 배치에서 맞닿았던 두 공 */
export function ballPairKey(
  a: "red" | "yellow" | "white",
  b: "red" | "yellow" | "white"
): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/**
 * 경로 그리기 **전** 배치 기준으로 이미 원둘레가 맞닿아 있던 공 쌍.
 * 재생 중 해당 쌍의 맞닿음은 충돌로 보지 않는다(난구노트 난구의 초기 밀착 배치).
 */
export function collectInitialTouchingBallPairs(
  placement: NanguBallPlacement,
  rect: PlayfieldRect
): Set<string> {
  const balls: { key: "red" | "yellow" | "white"; n: NormPoint }[] = [
    { key: "red", n: placement.redBall },
    { key: "yellow", n: placement.yellowBall },
    { key: "white", n: placement.whiteBall },
  ];
  const set = new Set<string>();
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (areBallCentersTouchingOrCloser(balls[i].n, balls[j].n, rect)) {
        set.add(ballPairKey(balls[i].key, balls[j].key));
      }
    }
  }
  return set;
}

export type CuePhaseCollisionOptions = {
  /**
   * @deprecated {@link neverWarnWhenTouchingBallKeys} + {@link firstObjectBallKey}/{@link warnReContactAfterProgress} 권장
   */
  ignoreTouchingBallKeys?: readonly ("red" | "yellow" | "white")[];
  /**
   * 수구 재생 중 이 공(들)과 맞닿아도 충돌 팝업 없음 — **2목**(1목이 아닌 비수구) 등
   */
  neverWarnWhenTouchingBallKeys?: readonly ("red" | "yellow" | "white")[];
  /**
   * 1목: `cuePathProgress01 < warnReContactAfterProgress` 구간의 맞닿음은 의도적 첫 접촉으로 무시,
   * 그 이후 맞닿음은 `cuePathOverlapWithFirstObjectSegment === true`일 때만 **수구↔1목 재충돌**로 팝업
   */
  firstObjectBallKey?: "red" | "yellow" | "white" | null;
  cuePathProgress01?: number;
  warnReContactAfterProgress?: number;
  /**
   * 수구 진행 위치에서 수구·1목 폴리라인이 공선 겹침인지. 미전달 시 이전 동작(재접촉만으로 경고)과 동일.
   */
  cuePathOverlapWithFirstObjectSegment?: boolean;
  /** 재생 시작 시 이미 맞닿아 있던 쌍 — 수구·목적구 포함, 맞닿음 유지 시 충돌 아님 */
  initialTouchingPairs?: ReadonlySet<string>;
};

/** 수구 이동 중: 비수구·다른 수구색과의 맞닿음 — 2목은 무시, 1목은 첫 접촉(progress 임계 전)만 무시 후 재접촉 시 충돌 */
export function cuePhaseCollisionWithOthers(
  cueNorm: NormPoint,
  placement: NanguBallPlacement,
  rect: PlayfieldRect,
  options?: CuePhaseCollisionOptions
): boolean {
  const legacySkip = new Set(options?.ignoreTouchingBallKeys ?? []);
  const initialPairs = options?.initialTouchingPairs;
  const cueKey = placement.cueBall === "yellow" ? "yellow" : "white";
  const skipInitialWithCue = (otherKey: "red" | "yellow" | "white") =>
    initialPairs?.has(ballPairKey(cueKey, otherKey)) ?? false;

  const ignoreTouchForCollision = (key: "red" | "yellow" | "white"): boolean => {
    if (key === cueKey) return true;
    if (options?.neverWarnWhenTouchingBallKeys?.includes(key)) return true;
    const prog = options?.cuePathProgress01;
    const th = options?.warnReContactAfterProgress;
    const firstK = options?.firstObjectBallKey;
    const overlapSeg = options?.cuePathOverlapWithFirstObjectSegment;
    if (firstK === key && prog !== undefined && th !== undefined) {
      if (prog < th - 1e-6) return true;
      if (overlapSeg !== undefined && overlapSeg !== true) return true;
    }
    if (legacySkip.has(key)) return true;
    return false;
  };

  if (
    !ignoreTouchForCollision("red") &&
    !skipInitialWithCue("red") &&
    areBallCentersTouchingOrCloser(cueNorm, placement.redBall, rect)
  )
    return true;
  if (placement.cueBall === "white") {
    if (
      !ignoreTouchForCollision("yellow") &&
      !skipInitialWithCue("yellow") &&
      areBallCentersTouchingOrCloser(cueNorm, placement.yellowBall, rect)
    )
      return true;
  } else {
    if (
      !ignoreTouchForCollision("white") &&
      !skipInitialWithCue("white") &&
      areBallCentersTouchingOrCloser(cueNorm, placement.whiteBall, rect)
    )
      return true;
  }
  return false;
}

/**
 * 1목(수구 제외 2구 중 실제 맞은 공) 이동 중: 나머지 두 공(수구 끝 위치 + 제3구)과 접촉.
 * `skipEarlyVsCue`: 충돌 직후 구간에서 맞은 공이 수구 맞춤 지점 근처일 때 오탐 방지
 */
export type ObjectPhaseCollisionOptions = {
  initialTouchingPairs?: ReadonlySet<string>;
};

export function objectPhaseCollisionWithOthers(
  movingObjectNorm: NormPoint,
  movingBallKey: "red" | "yellow" | "white",
  placement: NanguBallPlacement,
  cueEndNorm: NormPoint,
  rect: PlayfieldRect,
  skipEarlyVsCue: boolean,
  progress01: number,
  options?: ObjectPhaseCollisionOptions
): boolean {
  const OBJECT_PHASE_SKIP_UNTIL_T = 0.12;
  const initialPairs = options?.initialTouchingPairs;

  for (const key of ["red", "yellow", "white"] as const) {
    if (key === movingBallKey) continue;
    if (initialPairs?.has(ballPairKey(movingBallKey, key))) continue;
    const other: NormPoint =
      key === placement.cueBall
        ? cueEndNorm
        : key === "red"
          ? placement.redBall
          : key === "yellow"
            ? placement.yellowBall
            : placement.whiteBall;
    if (areBallCentersTouchingOrCloser(movingObjectNorm, other, rect)) {
      const otherIsCue = key === placement.cueBall;
      if (otherIsCue && skipEarlyVsCue && progress01 < OBJECT_PHASE_SKIP_UNTIL_T) continue;
      return true;
    }
  }
  return false;
}
