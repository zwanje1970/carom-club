/**
 * 해법(NanguSolutionData) + 배치 → 경로 폴리라인 + 이동 계획 (시각화용)
 * - 경로 계산과 이동 거리 계산은 하위 모듈에 위임
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguPathPoint,
  type NanguSolutionData,
  type NanguSolutionPath,
} from "@/lib/nangu-types";
import {
  computePolylinePlaybackDurationMs,
  computeStrokeAnimationDurationMs,
  computeStrokeAnimationDurationSec,
} from "@/lib/path-animation-timing";
import {
  polylineSegmentLengthsPx,
  polylineTotalLengthPx,
  sampleMotionAlongPath,
  type NormPoint,
  type PositionAlongPathResult,
} from "@/lib/path-motion-geometry";
import {
  computeCueMoveDistancePx,
  computeObjectMoveDistancePx,
  computeStrokeTotalPowerReferencePx,
  resolveMoveDistanceRailCount,
  type MoveDistanceParams,
} from "@/lib/path-motion-distance";
import type { RailCount } from "@/lib/rail-power-constants";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";
import { cueFirstObjectHitFromBallPlacement } from "@/lib/solution-path-geometry";
import { computeThicknessCollisionSplitFromSolution } from "@/lib/thickness-power-split";
import { objectBallKeyForBallSpot } from "@/lib/trouble-first-object-ball";

export type { NormPoint, PositionAlongPathResult };

/** `visualizationPlayback`: 경로 시연 — 마지막 스팟까지 전 구간 이동 + 플레이필드 긴 변 왕복 기준 재생 시간 */
export type BuildPathMotionPlanOptions = {
  visualizationPlayback?: boolean;
  /**
   * 시연 시 1목 경로 꼭짓점(첫 점 제외)을 오버레이와 동일하게 `spotCenterNormForDraw`로 맞춤.
   * 보통 `getNonCueBallNorms(placement)`의 `{x,y}` 배열.
   */
  objectBallNormsForSpotDraw?: readonly { x: number; y: number }[];
};

export interface PathMotionPlan {
  /** 정규화 꼭짓점 (이동 허용 경로) */
  polylineNormalized: NormPoint[];
  /** 경로 전체 길이 (px) */
  pathLengthPx: number;
  /** 의도 이동 거리 (px), 보정 적용 후 */
  moveDistancePx: number;
  /** min(moveDistancePx, pathLengthPx) — 스트로크 1회 실제 최대 이동 */
  effectiveTravelPx: number;
  /** 레일·쿠션 반영 총 참조 힘(px), 두께 분배 전 */
  strokeTotalPowerReferencePx?: number;
  /** 두께 정규화 0..1 (시각화·디버그) */
  thickness01?: number;
  /** totalPower 대비 수구 분배 */
  cueRetain?: number;
  /** totalPower 대비 1목 분배 */
  objectTransfer?: number;
  /** 세기 레일(1~5) — 볼 스피드·레거시 speed에서 유도 */
  powerRailCount?: RailCount;
  /** 스트로크 재생 시간(초), `PATH_ANIMATION_TIMING` 기준 */
  animationDurationSec?: number;
  animationDurationMs?: number;
}

function cuePositionFromPlacement(placement: NanguBallPlacement): NormPoint {
  return placement.cueBall === "yellow" ? placement.yellowBall : placement.whiteBall;
}

function countCushionsInPath(path: NanguSolutionPath | undefined): number {
  const typed = path?.pointsWithType;
  if (typed?.length) return typed.filter((p) => p.type === "cushion").length;
  return 0;
}

function verticesFromCueAndSpots(cue: NormPoint, spotCoords: { x: number; y: number }[]): NormPoint[] {
  if (spotCoords.length === 0) return [cue];
  return [cue, ...spotCoords.map((p) => ({ x: p.x, y: p.y }))];
}

/** reflectionPath: pts[0]=시작, pts[1..]↔typed[0..] — 시연 시 스팟 표시 중심과 재생 폴리라인 일치 */
function objectReflectionPolylineNormalized(
  firstVertex: NormPoint,
  pts: readonly { x: number; y: number }[],
  typed: NanguPathPoint[] | undefined,
  rect: PlayfieldRect,
  options?: BuildPathMotionPlanOptions
): NormPoint[] {
  const rawTail = pts.slice(1).map((p) => ({ x: p.x, y: p.y }));
  const canUseSpotDraw =
    Boolean(options?.visualizationPlayback) &&
    (options?.objectBallNormsForSpotDraw?.length ?? 0) > 0 &&
    Boolean(typed) &&
    typed!.length === pts.length - 1;

  if (!canUseSpotDraw) {
    return [{ x: firstVertex.x, y: firstVertex.y }, ...rawTail];
  }

  const spotOpts = { objectBallNorms: options!.objectBallNormsForSpotDraw! };
  const tail = typed!.map((p) => spotCenterNormForDraw(p, rect, spotOpts));
  return [{ x: firstVertex.x, y: firstVertex.y }, ...tail];
}

function buildMoveParamsFromSolution(
  data: Pick<NanguSolutionData, "isBankShot" | "thicknessOffsetX" | "ballSpeed" | "speedLevel" | "speed">,
  cushionCount: number
): MoveDistanceParams {
  return {
    ballSpeed: data.ballSpeed,
    speedLevel: data.speedLevel,
    speed: data.speed,
    cushionCount,
    isBankShot: data.isBankShot,
    thicknessOffsetX: data.thicknessOffsetX,
  };
}

/**
 * 수구 진행 경로 (paths[0]) 에 대한 이동 계획
 */
export function buildCuePathMotionPlan(
  placement: NanguBallPlacement,
  data: NanguSolutionData,
  rect: PlayfieldRect,
  options?: BuildPathMotionPlanOptions
): PathMotionPlan | null {
  const path = data.paths?.[0];
  const spots = path?.points;
  if (!spots?.length) return null;

  const cue = cuePositionFromPlacement(placement);
  /** 시연: 오버레이 스팟과 동일한 중심(쿠션 등 clamp)으로 꼭짓점을 맞춰 수구가 스팟과 정확히 겹치며 이동 */
  const typed = path.pointsWithType;
  const objectNorms = getNonCueBallNorms(placement);
  const spotOpts = { objectBallNorms: objectNorms.map((b) => ({ x: b.x, y: b.y })) };
  const firstHitForViz =
    options?.visualizationPlayback &&
    typed &&
    typed.length === spots.length &&
    typed[0]?.type === "ball"
      ? cueFirstObjectHitFromBallPlacement(cue, typed[0], placement, rect)
      : null;
  const struckForFirst =
    firstHitForViz && objectNorms.find((b) => b.key === firstHitForViz.objectKey);
  const poly =
    options?.visualizationPlayback && typed && typed.length === spots.length
      ? [
          cue,
          ...typed.map((p, i) =>
            spotCenterNormForDraw(p, rect, {
              ...spotOpts,
              ...(i === 0 && struckForFirst
                ? { cueFirstSpotStruckBallNorm: { x: struckForFirst.x, y: struckForFirst.y } }
                : {}),
            })
          ),
        ]
      : verticesFromCueAndSpots(cue, spots);
  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const cushionCount = countCushionsInPath(path);
  const moveParams = buildMoveParamsFromSolution(data, cushionCount);
  const split = computeThicknessCollisionSplitFromSolution(data.isBankShot ?? false, data.thicknessOffsetX);
  const strokeTotalPowerReferencePx = computeStrokeTotalPowerReferencePx(rect, moveParams);
  const physicsMoveDistancePx = computeCueMoveDistancePx(rect, moveParams);
  const moveDistancePx = options?.visualizationPlayback ? pathLengthPx : physicsMoveDistancePx;
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const powerRailCount = resolveMoveDistanceRailCount(moveParams);
  const animationDurationSec = options?.visualizationPlayback
    ? computePolylinePlaybackDurationMs(pathLengthPx, rect) / 1000
    : computeStrokeAnimationDurationSec(powerRailCount);
  const animationDurationMs = options?.visualizationPlayback
    ? computePolylinePlaybackDurationMs(pathLengthPx, rect)
    : computeStrokeAnimationDurationMs(powerRailCount);

  return {
    polylineNormalized: poly,
    pathLengthPx,
    moveDistancePx,
    effectiveTravelPx,
    strokeTotalPowerReferencePx,
    thickness01: split.thickness01,
    cueRetain: split.cueRetain,
    objectTransfer: split.objectTransfer,
    powerRailCount,
    animationDurationSec,
    animationDurationMs,
  };
}

/**
 * 1목 반사 경로 시연이 있을 때: 수구는 **마지막 `ball` 스팟(스위치)** 까지만 이동한다.
 * 그 뒤에 쿠션·end 스팟이 더 있어도 시연용 수구 폴리라인은 여기서 자른다.
 */
export type CueFirstObjectHitProgressSource =
  | "struck-first-ball"
  | "first-any-ball"
  | "last-ball"
  | "end";

/**
 * Trouble 시연: **전체** 빨간 수구 폴리라인에서 1목과의 **첫** 의도 충돌 지점까지의 거리 비율(0..1).
 * - `reflectionObjectBall`과 일치하는 **첫** `ball` 스팟 우선
 * - 없으면 첫 유효 공 스팟 → 마지막 공 스팟(레거시) → 1
 *
 * `pathProgress`(감속 τ 기준 경로 진행률)가 이 값에 도달하면 1목 object 페이즈를 시작해도 됨.
 * (과거: 마지막 ball 스팟 비율을 쓰면 1목이 수구 시연 끝까지 밀림.)
 */
export function computeCueProgress01ForFirstObjectHitAlongFullPath(
  plan: PathMotionPlan,
  pathPoints: readonly NanguPathPoint[],
  placement: NanguBallPlacement,
  rect: PlayfieldRect,
  struckKey: "red" | "yellow" | "white" | null | undefined
): {
  pHit01: number;
  hitPathPointIndex: number | null;
  source: CueFirstObjectHitProgressSource;
} {
  const dTotal = plan.pathLengthPx;
  const lens = polylineSegmentLengthsPx(plan.polylineNormalized, rect);
  const cumToSpotIndex = (pathPointIndex: number): number => {
    let cum = 0;
    const lastSeg = Math.min(pathPointIndex, lens.length - 1);
    for (let s = 0; s <= lastSeg && s < lens.length; s++) cum += lens[s] ?? 0;
    return cum;
  };
  const toP = (cum: number) => (dTotal > 0 ? Math.min(1, cum / dTotal) : 1);

  if (struckKey) {
    for (let i = 0; i < pathPoints.length; i++) {
      const p = pathPoints[i]!;
      if (p.type !== "ball") continue;
      const k = objectBallKeyForBallSpot(p, placement, rect);
      if (k === struckKey) {
        return {
          pHit01: toP(cumToSpotIndex(i)),
          hitPathPointIndex: i,
          source: "struck-first-ball",
        };
      }
    }
  }

  for (let i = 0; i < pathPoints.length; i++) {
    const p = pathPoints[i]!;
    if (p.type !== "ball") continue;
    const k = objectBallKeyForBallSpot(p, placement, rect);
    if (k != null) {
      return {
        pHit01: toP(cumToSpotIndex(i)),
        hitPathPointIndex: i,
        source: "first-any-ball",
      };
    }
  }

  let lastBallIdx = -1;
  for (let i = pathPoints.length - 1; i >= 0; i--) {
    if (pathPoints[i]?.type === "ball") {
      lastBallIdx = i;
      break;
    }
  }
  if (lastBallIdx >= 0) {
    return {
      pHit01: toP(cumToSpotIndex(lastBallIdx)),
      hitPathPointIndex: lastBallIdx,
      source: "last-ball",
    };
  }

  return { pHit01: 1, hitPathPointIndex: null, source: "end" };
}

export function truncateCuePathPlanAtLastBallSpotForPlayback(
  plan: PathMotionPlan,
  pathPoints: NanguPathPoint[],
  rect: PlayfieldRect,
  hasReflectionPath: boolean
): PathMotionPlan {
  if (!hasReflectionPath || pathPoints.length === 0) return plan;
  let lastBallIdx = -1;
  for (let i = pathPoints.length - 1; i >= 0; i--) {
    if (pathPoints[i]!.type === "ball") {
      lastBallIdx = i;
      break;
    }
  }
  if (lastBallIdx < 0) return plan;
  const poly = plan.polylineNormalized;
  const endExclusive = lastBallIdx + 2;
  if (endExclusive < 2 || endExclusive > poly.length) return plan;
  const truncated = poly.slice(0, endExclusive);
  const pathLengthPx = polylineTotalLengthPx(truncated, rect);
  const moveDistancePx = pathLengthPx;
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const animationDurationMs = computePolylinePlaybackDurationMs(pathLengthPx, rect);
  return {
    ...plan,
    polylineNormalized: truncated,
    pathLengthPx,
    moveDistancePx,
    effectiveTravelPx,
    animationDurationMs,
    animationDurationSec: animationDurationMs / 1000,
  };
}

/**
 * 1목적구 경로 (reflectionPath.points[0]=충돌점 …)
 */
export function buildObjectPathMotionPlan(
  data: NanguSolutionData,
  rect: PlayfieldRect,
  options?: BuildPathMotionPlanOptions
): PathMotionPlan | null {
  const rp = data.reflectionPath;
  const pts = rp?.points;
  if (!pts || pts.length < 2) return null;

  const typed: NanguPathPoint[] | undefined = rp.pointsWithType;
  const poly = objectReflectionPolylineNormalized(
    { x: pts[0].x, y: pts[0].y },
    pts,
    typed,
    rect,
    options
  );
  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const cushionCount = typed?.filter((p) => p.type === "cushion").length ?? 0;
  const moveParams = buildMoveParamsFromSolution(data, cushionCount);
  const split = computeThicknessCollisionSplitFromSolution(data.isBankShot ?? false, data.thicknessOffsetX);
  const strokeTotalPowerReferencePx = computeStrokeTotalPowerReferencePx(rect, moveParams);
  const physicsMoveDistancePx = computeObjectMoveDistancePx(rect, moveParams);
  const moveDistancePx = options?.visualizationPlayback ? pathLengthPx : physicsMoveDistancePx;
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const powerRailCount = resolveMoveDistanceRailCount(moveParams);
  const animationDurationSec = options?.visualizationPlayback
    ? computePolylinePlaybackDurationMs(pathLengthPx, rect) / 1000
    : computeStrokeAnimationDurationSec(powerRailCount);
  const animationDurationMs = options?.visualizationPlayback
    ? computePolylinePlaybackDurationMs(pathLengthPx, rect)
    : computeStrokeAnimationDurationMs(powerRailCount);

  return {
    polylineNormalized: poly,
    pathLengthPx,
    moveDistancePx,
    effectiveTravelPx,
    strokeTotalPowerReferencePx,
    thickness01: split.thickness01,
    cueRetain: split.cueRetain,
    objectTransfer: split.objectTransfer,
    powerRailCount,
    animationDurationSec,
    animationDurationMs,
  };
}

/**
 * 수구 푸시 구간 끝에서의 1목 실제 위치로 `reflectionPath` 첫 꼭짓점을 맞춤.
 * (저장된 충돌점과 수 mm 단위 차이가 나도 시연 연속성 유지)
 */
export function buildObjectPathMotionPlanWithStartVertex(
  data: NanguSolutionData,
  objectStartNorm: NormPoint,
  rect: PlayfieldRect,
  options?: BuildPathMotionPlanOptions
): PathMotionPlan | null {
  const base = buildObjectPathMotionPlan(data, rect, options);
  const pts = data.reflectionPath?.points;
  const typed = data.reflectionPath?.pointsWithType;
  if (!base || !pts || pts.length < 2) return null;

  const poly = objectReflectionPolylineNormalized(objectStartNorm, pts, typed, rect, options);
  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const moveDistancePx = options?.visualizationPlayback ? pathLengthPx : base.moveDistancePx;
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const animationDurationMs =
    options?.visualizationPlayback === true
      ? computePolylinePlaybackDurationMs(pathLengthPx, rect)
      : (base.animationDurationMs ?? computePolylinePlaybackDurationMs(pathLengthPx, rect));
  const animationDurationSec = animationDurationMs / 1000;

  return {
    ...base,
    polylineNormalized: poly,
    pathLengthPx,
    moveDistancePx,
    effectiveTravelPx,
    animationDurationMs,
    animationDurationSec,
  };
}

/**
 * 스트로크 진행률 0..1 에 따른 공 위치 (경로 위만)
 */
export function sampleCueMotion(
  plan: PathMotionPlan,
  progress01: number,
  rect: PlayfieldRect
): PositionAlongPathResult {
  return sampleMotionAlongPath(
    plan.polylineNormalized,
    plan.pathLengthPx,
    plan.moveDistancePx,
    progress01,
    rect
  );
}

export function sampleObjectMotion(
  plan: PathMotionPlan,
  progress01: number,
  rect: PlayfieldRect
): PositionAlongPathResult {
  return sampleMotionAlongPath(
    plan.polylineNormalized,
    plan.pathLengthPx,
    plan.moveDistancePx,
    progress01,
    rect
  );
}
