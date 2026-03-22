/**
 * 경로 재생 중 공-공 접촉 판정 (정규화 좌표 → 플레이필드 픽셀 거리)
 *
 * 설계: **겹침은 허용하지 않음**. 원둘레가 맞닿는 정도(중심거리 ≈ 2R)이면 접촉으로 본다.
 * 스위치 순간(수구가 1목 스팟에 일치) 등 **의도된 접촉**은 `ignoreTouchingBallKeys` 로 제외.
 * **재생 시작 시** 이미 맞닿아 있던 쌍(`collectInitialTouchingBallPairs`)은 재생 중 맞닿아도 충돌로 보지 않음.
 */
import {
  getBallRadius,
  getPlayfieldLongSide,
  normalizedToPixel,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement } from "@/lib/nangu-types";
import type { NormPoint } from "@/lib/path-motion-geometry";

/** 부동소수·픽셀 양자화 보정: `≤ 2R + ε` 이면 맞닿음으로 간주 */
const CONTACT_EPS_PX = 1.5;

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
 * 재생 중 해당 쌍의 맞닿음은 충돌로 보지 않는다(당구노트 난구의 초기 밀착 배치).
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
   * 그 이후 맞닿음만 **수구↔1목 재충돌**로 팝업
   */
  firstObjectBallKey?: "red" | "yellow" | "white" | null;
  cuePathProgress01?: number;
  warnReContactAfterProgress?: number;
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
    if (
      firstK === key &&
      prog !== undefined &&
      th !== undefined &&
      prog < th - 1e-6
    ) {
      return true;
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
