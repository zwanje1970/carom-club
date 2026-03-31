/**
 * 해법(NanguSolutionData) + 배치 → 경로 폴리라인 + 이동 계획 (시각화용)
 * - 경로 계산과 이동 거리 계산은 하위 모듈에 위임
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  ballLabeledNormForKey,
  getNonCueBallNorms,
  getSecondObjectBallKeyExclusive,
  type NanguBallPlacement,
  type NanguCurveNode,
  type NanguPathPoint,
  type NanguSolutionData,
  type NanguSolutionPath,
} from "@/lib/nangu-types";
import {
  computePolylinePlaybackDurationMs,
  computeStrokeAnimationDurationMs,
  computeStrokeAnimationDurationSec,
} from "@/lib/path-animation-timing";
import { isTroublePlaybackVerboseLogEnabled } from "@/lib/trouble-playback-verbose-log";
import {
  polylineSegmentLengthsPx,
  polylineTotalLengthPx,
  sampleMotionAlongPath,
  sampleMotionAlongPathWithEffectiveCost,
  type NormPoint,
  type PositionAlongPathResult,
} from "@/lib/path-motion-geometry";
import {
  computeCuePlaybackSegmentDampingPlan,
  computeObjectPlaybackSegmentDampingPlan,
} from "@/lib/path-curve-damping";
import {
  computeCueMoveDistancePx,
  computeObjectMoveDistancePx,
  computeStrokeTotalPowerReferencePx,
  resolveMoveDistanceRailCount,
  type MoveDistanceParams,
} from "@/lib/path-motion-distance";
import type { RailCount } from "@/lib/rail-power-constants";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { buildCueCurvedPlaybackPolyline, buildObjectCurvedPlaybackPolyline } from "@/lib/path-bezier-playback";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";
import {
  cueFirstObjectHitFromBallPlacement,
  distanceAlongOpenPolylineToFirstReachNormPointPx,
  PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX,
} from "@/lib/solution-path-geometry";
import { computeThicknessCollisionSplitFromSolution } from "@/lib/thickness-power-split";
import {
  getCuePlayableDistanceFromBallSpeed,
  troubleTotalMovableDistancePx,
} from "@/lib/trouble-playback-distance";
import { computeTroubleThicknessSplit } from "@/lib/trouble-thickness-split";
import { troubleHitStepFromThicknessOffsetX } from "@/lib/trouble-thickness-split";
import {
  objectBallKeyForBallSpot,
  resolveTroubleFirstObjectBallKey,
} from "@/lib/trouble-first-object-ball";
import {
  cuePositionFromPlacement,
  countCushionsInPath,
  objectReflectionPolylineNormalized,
  verticesFromCueAndSpots,
} from "@/lib/solver-engine/core/path-motion-core-helpers";
import { buildMoveParamsFromSolution } from "@/lib/solver-engine/policies/path-motion-policy";

export type { NormPoint, PositionAlongPathResult };

/** `visualizationPlayback`: 경로 시연 — 마지막 스팟까지 전 구간 이동 + 플레이필드 긴 변 왕복 기준 재생 시간 */
export type BuildPathMotionPlanOptions = {
  visualizationPlayback?: boolean;
  /**
   * 시연 시 1목 경로 꼭짓점(첫 점 제외)을 오버레이와 동일하게 `spotCenterNormForDraw`로 맞춤.
   * 보통 `getNonCueBallNorms(placement)`의 `{x,y}` 배열.
   */
  objectBallNormsForSpotDraw?: readonly { x: number; y: number }[];
  /**
   * 난구: 재생만 곡선 — `pathPoints`와 별도의 표시용 베지어 제어점(판정·경고는 직선 유지)
   */
  cuePathCurveControls?: PathSegmentCurveControl[];
  /** 수구 재생 — `cuePathCurveControls`보다 우선(저장 구조·렌더와 동일) */
  cuePathCurveNodes?: NanguCurveNode[];
  objectPathCurveControls?: PathSegmentCurveControl[];
  /** 1목 재생 — `objectPathCurveControls`보다 우선 */
  objectPathCurveNodes?: NanguCurveNode[];
  /**
   * 난구 재생: 볼스피드 n레일 거리 모델 + 두께 표(L=step/20) 적용 (직선 판정 엔진과 분리)
   */
  troublePlaybackModel?: boolean;
  /** true면 물리 계산(ballSpeed/thickness/damping)을 무시하고 경로 길이 100% 재생 */
  ignorePhysics?: boolean;
  /** trouble 시연: 충돌 전 수구 사용 후 남은 예산(px). object post 캡에 우선 사용 */
  playbackRemainingAfterPrePx?: number;
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
  /**
   * 곡선 재생 시 스팟 i 끝에 해당하는 폴리라인 꼭짓점 인덱스(잘라내기·1목 진입 비율용)
   * 직선만일 때는 [1,2,…,pathPoints.length]
   */
  spotEndVertexIndices?: number[];
  /** trouble 시연: UI 볼스피드 기준 수구 이동 가능 거리(px), `min` 적용 전 */
  playbackCuePlayableDistancePx?: number;
  /** trouble 시연: UI 볼스피드 기준 1목 이동 가능 거리(px), 두께 분배 없이 `totalMovable`과 동일 스케일 */
  playbackObjectPlayableDistancePx?: number;
  /** trouble 시연: 두께 기반 1목 전달 비율 L */
  playbackThicknessLossRatioL?: number;
  /** trouble 시연: 충돌 직전 기준 이동 가능 거리 V(px) — 볼스피드 모델 */
  playbackCueDistanceBeforeHitPx?: number;
  /** trouble 시연: 충돌 전 수구 사용 후 남은 예산(px) */
  playbackRemainingAfterPrePx?: number;
  /** trouble 시연: 충돌 후 수구 경로에 허용되는 거리 상한 remaining×(1−L)(px) */
  playbackCueDistanceAfterHitCapPx?: number;
  /** trouble 시연: 1목 반사 경로가 있을 때 두께 분배를 수구 pre/post·1목에 적용했는지 */
  playbackThicknessSplitApplied?: boolean;
  /** 시연: 곡선 세그먼트 유효 거리 소모 합 Σ(L/coeff) */
  playbackEffectivePathCostPx?: number;
  playbackLogicalSegmentPhysicalLengthsPx?: number[];
  playbackLogicalSegmentCurveCoefficients?: number[];
  playbackCurveDampingApplied?: boolean;
  playbackCurveDampingMeanCoefficient?: number;
  playbackCurveDampingCurveSegmentCount?: number;
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
  const struckForFirst = firstHitForViz
    ? ballLabeledNormForKey(placement, firstHitForViz.objectKey)
    : null;
  const polyStraight =
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

  let poly = polyStraight;
  let spotEndVertexIndices: number[] | undefined;
  const hasCueCurveForPlayback =
    (options?.cuePathCurveControls?.length ?? 0) > 0 || (options?.cuePathCurveNodes?.length ?? 0) > 0;
  if (
    options?.visualizationPlayback &&
    typed &&
    typed.length === spots.length &&
    hasCueCurveForPlayback
  ) {
    const curved = buildCueCurvedPlaybackPolyline(
      polyStraight,
      typed,
      options.cuePathCurveControls,
      options.cuePathCurveNodes
    );
    poly = curved.vertices;
    spotEndVertexIndices = curved.spotEndVertexIndices;
  } else if (options?.visualizationPlayback && typed && typed.length === spots.length) {
    spotEndVertexIndices = typed.map((_, i) => i + 1);
  }

  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const cushionCount = countCushionsInPath(path);
  const moveParams = buildMoveParamsFromSolution(data, cushionCount);
  const troubleModel = Boolean(options?.troublePlaybackModel);
  const ignorePhysics = Boolean(options?.visualizationPlayback && troubleModel && options?.ignorePhysics);
  const split = ignorePhysics
    ? { thickness01: 0.5, cueRetain: 1, objectTransfer: 0 }
    : troubleModel
      ? computeTroubleThicknessSplit(data.isBankShot ?? false, data.thicknessOffsetX)
      : computeThicknessCollisionSplitFromSolution(data.isBankShot ?? false, data.thicknessOffsetX);
  const ballSpeedVal = data.ballSpeed ?? 3;
  const totalMovablePx =
    !ignorePhysics && troubleModel ? troubleTotalMovableDistancePx(rect, ballSpeedVal) : undefined;
  const cuePlayablePx =
    !ignorePhysics && troubleModel && options?.visualizationPlayback
      ? getCuePlayableDistanceFromBallSpeed(rect, ballSpeedVal)
      : undefined;
  const strokeTotalPowerReferencePx =
    ignorePhysics
      ? undefined
      : troubleModel
        ? cuePlayablePx ?? totalMovablePx
        : computeStrokeTotalPowerReferencePx(rect, moveParams);
  const physicsMoveDistancePx = computeCueMoveDistancePx(rect, moveParams);
  const L = split.objectTransfer;
  const hasReflectionForThicknessSplit =
    Boolean(data.reflectionPath?.points && data.reflectionPath.points.length >= 2) &&
    data.reflectionObjectBall != null &&
    typed &&
    typed.length === spots.length;

  let moveDistancePx: number = pathLengthPx;
  let playbackThicknessSplitApplied = false;
  let playbackCueDistanceAfterHitCapPx: number | undefined;
  let playbackCueDistanceBeforeHitPx: number | undefined;
  let playbackThicknessLossRatioL: number | undefined;
  let playbackRemainingAfterPrePx: number | undefined;
  let playbackCueDistanceBeforeHitAppliedPx: number | undefined;
  let playbackCueDistanceAfterHitAppliedPx: number | undefined;
  let playbackObjectDistanceAfterHitAppliedPx: number | undefined;

  if (ignorePhysics) {
    moveDistancePx = pathLengthPx;
    if (process.env.NODE_ENV !== "production") {
      console.debug("[trouble-playback:path-only]", {
        ignorePhysics: true,
        appliedPx: pathLengthPx,
        pathLength: pathLengthPx,
      });
    }
  } else if (options?.visualizationPlayback && troubleModel && cuePlayablePx != null) {
    const V = cuePlayablePx;
    playbackCueDistanceBeforeHitPx = V;
    playbackThicknessLossRatioL = L;

    if (hasReflectionForThicknessSplit) {
      const tempPlan: PathMotionPlan = {
        polylineNormalized: poly,
        pathLengthPx,
        moveDistancePx: pathLengthPx,
        effectiveTravelPx: pathLengthPx,
        spotEndVertexIndices,
      };
      const objectPtsForResolve: NanguPathPoint[] = data.reflectionPath?.pointsWithType ?? [];
      const hitAlong = resolveTroubleCueHitProgress01(
        tempPlan,
        typed,
        objectPtsForResolve,
        placement,
        cue,
        rect,
        data.reflectionObjectBall
      );
      const dHit = hitAlong.pHit01 * pathLengthPx;
      const dPost = Math.max(0, pathLengthPx - dHit);
      const cuePreLimit = Math.min(dHit, V);
      const remaining = Math.max(0, V - cuePreLimit);
      const cuePostLimit = Math.min(dPost, remaining * (1 - L));
      moveDistancePx = cuePreLimit + cuePostLimit;
      playbackRemainingAfterPrePx = remaining;
      playbackCueDistanceBeforeHitAppliedPx = cuePreLimit;
      playbackCueDistanceAfterHitAppliedPx = cuePostLimit;
      playbackObjectDistanceAfterHitAppliedPx = remaining * L;
      playbackThicknessSplitApplied = true;
      playbackCueDistanceAfterHitCapPx = remaining * (1 - L);
    } else {
      moveDistancePx = Math.min(pathLengthPx, V);
      playbackCueDistanceBeforeHitAppliedPx = moveDistancePx;
      playbackCueDistanceAfterHitAppliedPx = 0;
      playbackObjectDistanceAfterHitAppliedPx = V * L;
    }
    if (isTroublePlaybackVerboseLogEnabled()) {
      console.debug("[trouble-playback:cue-plan]", {
        V,
        L,
        cuePreAppliedPx: playbackCueDistanceBeforeHitAppliedPx,
        cuePostAppliedPx: playbackCueDistanceAfterHitAppliedPx,
      });
    }
  } else if (options?.visualizationPlayback) {
    moveDistancePx = pathLengthPx;
  } else {
    moveDistancePx = physicsMoveDistancePx;
  }
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const curveDampingPlan =
    options?.visualizationPlayback &&
    !troubleModel &&
    typed &&
    typed.length === spots.length &&
    spotEndVertexIndices &&
    spotEndVertexIndices.length === typed.length
      ? computeCuePlaybackSegmentDampingPlan(
          poly,
          polyStraight,
          typed,
          spotEndVertexIndices,
          rect,
          options.cuePathCurveControls,
          options.cuePathCurveNodes
        )
      : null;
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
    spotEndVertexIndices,
    playbackCuePlayableDistancePx: cuePlayablePx,
    playbackThicknessLossRatioL,
    playbackCueDistanceBeforeHitPx,
    playbackRemainingAfterPrePx,
    playbackCueDistanceAfterHitCapPx,
    playbackThicknessSplitApplied,
    playbackEffectivePathCostPx: curveDampingPlan?.effectivePathCostPx,
    playbackLogicalSegmentPhysicalLengthsPx: curveDampingPlan?.logicalSegmentPhysicalLengthsPx,
    playbackLogicalSegmentCurveCoefficients: curveDampingPlan?.logicalSegmentCurveCoefficients,
    playbackCurveDampingApplied: Boolean(curveDampingPlan && curveDampingPlan.curveSegmentCount > 0),
    playbackCurveDampingMeanCoefficient: curveDampingPlan?.meanCurveCoefficient,
    playbackCurveDampingCurveSegmentCount: curveDampingPlan?.curveSegmentCount,
  };
}

/**
 * 1목 반사 경로 시엘이 있을 때: 수구는 **마지막 `ball` 스팟(스위치)** 까지만 이동한다.
 * 그 뒤에 쿠션·end 스팟이 더 있어도 시연용 수구 폴리라인은 여기서 자른다.
 */
export type CueFirstObjectHitProgressSource =
  | "struck-first-ball"
  | "struck-last-ball"
  | "first-any-ball"
  | "last-ball"
  | "geometry-hit"
  | "end";

/**
 * Trouble 시연: **전체** 폴리라인에서 **맞춤 공**과 연결된 **첫** `ball` 스팟까지의 거리 비율(0..1).
 * - `struckKey`가 있으면: 그 키와 일치하는 **첫** 공 스팟만 사용한다. 없으면 `pHit01: 1`(end) — 다른 공 스팟(first-any)으로
 *   잡으면 1목 경로에서 2목 맞춤이 1목 스팟에 붙는 순간으로 밀리거나, 수구 경로에서 잘못된 조기 히트가 난다.
 * - `struckKey`가 없으면: 첫 유효 공 스팟 → 마지막 공 스팟(레거시) → 1
 *
 * `pathProgress`(감속 τ 기준 경로 진행률)가 이 값에 도달하면 1목 object 페이즈를 시작해도 됨.
 * 거리는 재생 폴리라인상 **스팟 중심 꼭짓점**까지의 호장 — 공 중심이 스팟 중심과 일치할 때 해당 지점에 도달한다.
 * (과거: 마지막 ball 스팟 비율을 쓰면 1목이 수구 시연 끝까지 밀림.)
 */
export function computeCueProgress01ForFirstObjectHitAlongFullPath(
  plan: PathMotionPlan,
  pathPoints: readonly NanguPathPoint[],
  placement: NanguBallPlacement,
  rect: PlayfieldRect,
  struckKey: "red" | "yellow" | "white" | null | undefined,
  options?: { struckBallMatch?: "first" | "last" }
): {
  pHit01: number;
  hitPathPointIndex: number | null;
  source: CueFirstObjectHitProgressSource;
} {
  const dTotal = plan.pathLengthPx;
  const lens = polylineSegmentLengthsPx(plan.polylineNormalized, rect);
  const cumToSpotIndex = (pathPointIndex: number): number => {
    const idx = plan.spotEndVertexIndices?.[pathPointIndex];
    if (idx != null && idx >= 0 && idx < plan.polylineNormalized.length) {
      const sub = plan.polylineNormalized.slice(0, idx + 1);
      return polylineTotalLengthPx(sub, rect);
    }
    let cum = 0;
    const lastSeg = Math.min(pathPointIndex, lens.length - 1);
    for (let s = 0; s <= lastSeg && s < lens.length; s++) cum += lens[s] ?? 0;
    return cum;
  };
  const toP = (cum: number) => (dTotal > 0 ? Math.min(1, cum / dTotal) : 1);
  const struckBallMatch = options?.struckBallMatch ?? "first";

  if (struckKey) {
    if (struckBallMatch === "last") {
      let lastIdx: number | null = null;
      let lastCum = 0;
      for (let i = 0; i < pathPoints.length; i++) {
        const p = pathPoints[i]!;
        if (p.type !== "ball") continue;
        const k = objectBallKeyForBallSpot(p, placement, rect);
        if (k === struckKey) {
          lastIdx = i;
          lastCum = cumToSpotIndex(i);
        }
      }
      if (lastIdx != null) {
        return {
          pHit01: toP(lastCum),
          hitPathPointIndex: lastIdx,
          source: "struck-last-ball",
        };
      }
      return { pHit01: 1, hitPathPointIndex: null, source: "end" };
    }
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
    return { pHit01: 1, hitPathPointIndex: null, source: "end" };
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

/**
 * 난구 재생: 1목 출발 거리 비율 — 저장된 `reflectionObjectBall`과 스팟→공 키가 어긋나도
 * `resolveTroubleFirstObjectBallKey`·첫 공 스팟(first-any) 순으로 맞춰 **수구가 1목 스팟에 닿는 지점**을 잡는다.
 */
export function resolveTroubleCueHitProgress01(
  plan: PathMotionPlan,
  cuePathPoints: readonly NanguPathPoint[],
  objectPathPoints: readonly NanguPathPoint[],
  placement: NanguBallPlacement,
  cuePosNorm: { x: number; y: number },
  rect: PlayfieldRect,
  playbackReflectionObjectBall: "red" | "yellow" | "white" | undefined
): {
  pHit01: number;
  hitPathPointIndex: number | null;
  source: CueFirstObjectHitProgressSource;
} {
  const tryKey = (k: "red" | "yellow" | "white" | undefined) =>
    computeCueProgress01ForFirstObjectHitAlongFullPath(plan, cuePathPoints, placement, rect, k);

  const orderedKeys: ("red" | "yellow" | "white")[] = [];
  const push = (k: "red" | "yellow" | "white" | null | undefined) => {
    if (k && !orderedKeys.includes(k)) orderedKeys.push(k);
  };
  push(playbackReflectionObjectBall);
  push(
    resolveTroubleFirstObjectBallKey({
      placement,
      cuePos: cuePosNorm,
      pathPoints: cuePathPoints as NanguPathPoint[],
      objectPathPoints: objectPathPoints as NanguPathPoint[],
      rect,
    })
  );

  for (const k of orderedKeys) {
    const r = tryKey(k);
    if (r.source === "struck-first-ball") return r;
  }

  const loose = tryKey(undefined);
  if (loose.pHit01 < 1 - 1e-9) return loose;

  /** 키 매칭 실패 등으로 위에서 못 잡았을 때: **2R 접촉이 아니라** 표시 스팟 중심이 폴리라인상 처음 일치하는 지점 */
  const objectNormsForSpot = getNonCueBallNorms(placement).map((b) => ({ x: b.x, y: b.y }));
  for (let i = 0; i < cuePathPoints.length; i++) {
    const p = cuePathPoints[i]!;
    if (p.type !== "ball") continue;
    const struckForFirst =
      i === 0
        ? (() => {
            const hit = cueFirstObjectHitFromBallPlacement(cuePosNorm, p, placement, rect);
            return hit ? ballLabeledNormForKey(placement, hit.objectKey) : null;
          })()
        : null;
    const spotCenter = spotCenterNormForDraw(p, rect, {
      objectBallNorms: objectNormsForSpot,
      ...(struckForFirst ? { cueFirstSpotStruckBallNorm: { x: struckForFirst.x, y: struckForFirst.y } } : {}),
    });
    const along = distanceAlongOpenPolylineToFirstReachNormPointPx(
      plan.polylineNormalized,
      spotCenter,
      rect,
      PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX
    );
    if (along != null && plan.pathLengthPx > 1e-6) {
      const pHit = Math.min(1, along / plan.pathLengthPx);
      if (pHit < 1 - 1e-9) {
        return { pHit01: pHit, hitPathPointIndex: i, source: "geometry-hit" };
      }
    }
  }

  return { pHit01: 1, hitPathPointIndex: null, source: "end" };
}

/**
 * 수구 경로 `pathPoints`의 한 스팟에 대해, 재생·오버레이와 같은 **스팟 중심(정규화)**.
 * 첫 스팟(i===0)은 수구 출발·점탭 광선 기준 `cueFirstSpotStruckBallNorm`을 반영한다.
 */
export function cuePathSpotCenterNormForPlaybackIndex(
  pathPoints: readonly NanguPathPoint[],
  pathPointIndex: number,
  placement: NanguBallPlacement,
  cuePosNorm: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } | null {
  const p = pathPoints[pathPointIndex];
  if (!p) return null;
  const objectNormsForSpot = getNonCueBallNorms(placement).map((b) => ({ x: b.x, y: b.y }));
  if (pathPointIndex === 0 && p.type === "ball") {
    const hit = cueFirstObjectHitFromBallPlacement(cuePosNorm, p, placement, rect);
    const struckForFirst = hit != null ? ballLabeledNormForKey(placement, hit.objectKey) : null;
    return spotCenterNormForDraw(p, rect, {
      objectBallNorms: objectNormsForSpot,
      ...(struckForFirst ? { cueFirstSpotStruckBallNorm: { x: struckForFirst.x, y: struckForFirst.y } } : {}),
    });
  }
  return spotCenterNormForDraw(p, rect, { objectBallNorms: objectNormsForSpot });
}

/**
 * 난구 재생: 2목 접촉까지의 거리 비율 — `plan` 폴리라인 + `pathPoints`(수구 경로 또는 1목 경로)에서 last-match 등으로 산출.
 * 재생에서 2목 페이즈 시작은 **수구** 기준이면 `cuePlan` + 수구 `pathPoints`를 넘긴다.
 */
export function resolveTroubleSecondObjectHitProgress01(
  objPlan: PathMotionPlan,
  objectPathPoints: readonly NanguPathPoint[],
  placement: NanguBallPlacement,
  rect: PlayfieldRect,
  playbackSecondObjectBall: "red" | "yellow" | "white" | undefined,
  firstObjectKey: "red" | "yellow" | "white"
): {
  pHit01: number;
  hitPathPointIndex: number | null;
  source: CueFirstObjectHitProgressSource;
} {
  /** 2목: 경로상 **마지막** 일치 스팟(접촉은 보통 후반). `first`면 1목 경로 앞쪽 잘못된 공 스팟에 걸려 2목이 너무 일찍 출발한다. */
  const tryKeyLast = (k: "red" | "yellow" | "white" | undefined) =>
    computeCueProgress01ForFirstObjectHitAlongFullPath(objPlan, objectPathPoints, placement, rect, k, {
      struckBallMatch: "last",
    });

  const orderedKeys: ("red" | "yellow" | "white")[] = [];
  const push = (k: "red" | "yellow" | "white" | null | undefined) => {
    if (k && !orderedKeys.includes(k)) orderedKeys.push(k);
  };
  push(playbackSecondObjectBall);
  const exclusiveSecondKey = getSecondObjectBallKeyExclusive(placement, firstObjectKey);
  push(exclusiveSecondKey ?? undefined);

  for (const k of orderedKeys) {
    const r = tryKeyLast(k);
    if (r.source === "struck-first-ball" || r.source === "struck-last-ball") return r;
  }

  const dTotalGeom = objPlan.pathLengthPx;
  const lens = polylineSegmentLengthsPx(objPlan.polylineNormalized, rect);
  const cumToSpotIndex = (pathPointIndex: number): number => {
    const idx = objPlan.spotEndVertexIndices?.[pathPointIndex];
    if (idx != null && idx >= 0 && idx < objPlan.polylineNormalized.length) {
      const sub = objPlan.polylineNormalized.slice(0, idx + 1);
      return polylineTotalLengthPx(sub, rect);
    }
    let cum = 0;
    const lastSeg = Math.min(pathPointIndex, lens.length - 1);
    for (let s = 0; s <= lastSeg && s < lens.length; s++) cum += lens[s] ?? 0;
    return cum;
  };
  const toP = (cum: number) => (dTotalGeom > 0 ? Math.min(1, cum / dTotalGeom) : 1);

  let lastNonFirstIdx: number | null = null;
  let lastNonFirstCum = 0;
  for (let i = 0; i < objectPathPoints.length; i++) {
    const p = objectPathPoints[i]!;
    if (p.type !== "ball") continue;
    const k = objectBallKeyForBallSpot(p, placement, rect);
    if (k != null && k !== firstObjectKey) {
      lastNonFirstIdx = i;
      lastNonFirstCum = cumToSpotIndex(i);
    }
  }
  if (lastNonFirstIdx != null) {
    return {
      pHit01: toP(lastNonFirstCum),
      hitPathPointIndex: lastNonFirstIdx,
      source: "struck-last-ball",
    };
  }

  /** 키 매칭 실패·탭 반경 밖 등: 마지막 `ball` 스팟이 2목(남은 공)이면 스팟 **중심**까지 순방향 호장으로만 폴백(2R 금지) */
  const secondKeyGeom = getSecondObjectBallKeyExclusive(placement, firstObjectKey);
  const remainingBall =
    secondKeyGeom != null ? ballLabeledNormForKey(placement, secondKeyGeom) : null;
  let lastBallIdx: number | null = null;
  for (let i = objectPathPoints.length - 1; i >= 0; i--) {
    if (objectPathPoints[i]?.type === "ball") {
      lastBallIdx = i;
      break;
    }
  }
  if (lastBallIdx != null && remainingBall && objPlan.polylineNormalized.length >= 2) {
    const p = objectPathPoints[lastBallIdx]!;
    const kb = objectBallKeyForBallSpot(p, placement, rect);
    if (kb == null || kb === remainingBall.key) {
      const objectNormsForSpot = getNonCueBallNorms(placement).map((b) => ({ x: b.x, y: b.y }));
      const spotCenter = spotCenterNormForDraw(p, rect, { objectBallNorms: objectNormsForSpot });
      const along = distanceAlongOpenPolylineToFirstReachNormPointPx(
        objPlan.polylineNormalized,
        spotCenter,
        rect,
        PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX
      );
      if (along != null && dTotalGeom > 1e-6) {
        const pHit = Math.min(1, along / dTotalGeom);
        if (pHit < 1 - 1e-9) {
          return { pHit01: pHit, hitPathPointIndex: lastBallIdx, source: "geometry-hit" };
        }
      }
    }
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
  let truncated: NormPoint[];
  const endBySpot = plan.spotEndVertexIndices?.[lastBallIdx];
  if (endBySpot != null && endBySpot + 1 <= poly.length) {
    truncated = poly.slice(0, endBySpot + 1);
  } else {
    const endExclusive = lastBallIdx + 2;
    if (endExclusive < 2 || endExclusive > poly.length) return plan;
    truncated = poly.slice(0, endExclusive);
  }
  const pathLengthPx = polylineTotalLengthPx(truncated, rect);
  const moveDistancePx = Math.min(pathLengthPx, plan.moveDistancePx);
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const animationDurationMs = computePolylinePlaybackDurationMs(pathLengthPx, rect);
  const spotEnd =
    plan.spotEndVertexIndices && lastBallIdx >= 0
      ? plan.spotEndVertexIndices.slice(0, lastBallIdx + 1)
      : plan.spotEndVertexIndices;

  return {
    ...plan,
    polylineNormalized: truncated,
    pathLengthPx,
    moveDistancePx,
    effectiveTravelPx,
    animationDurationMs,
    animationDurationSec: animationDurationMs / 1000,
    spotEndVertexIndices: spotEnd,
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
  const polyStraight = objectReflectionPolylineNormalized(
    { x: pts[0].x, y: pts[0].y },
    pts,
    typed,
    rect,
    options
  );

  let poly = polyStraight;
  let spotEndVertexIndices: number[] | undefined;
  const hasObjectCurveForPlayback =
    (options?.objectPathCurveControls?.length ?? 0) > 0 || (options?.objectPathCurveNodes?.length ?? 0) > 0;
  if (
    options?.visualizationPlayback &&
    typed &&
    typed.length === pts.length - 1 &&
    hasObjectCurveForPlayback
  ) {
    const curved = buildObjectCurvedPlaybackPolyline(
      polyStraight,
      typed,
      options.objectPathCurveControls,
      options.objectPathCurveNodes
    );
    poly = curved.vertices;
    spotEndVertexIndices = curved.spotEndVertexIndices;
  } else if (options?.visualizationPlayback && typed && typed.length === pts.length - 1) {
    spotEndVertexIndices = typed.map((_, i) => i + 1);
  }

  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const cushionCount = typed?.filter((p) => p.type === "cushion").length ?? 0;
  const moveParams = buildMoveParamsFromSolution(data, cushionCount);
  const troubleModel = Boolean(options?.troublePlaybackModel);
  const ignorePhysics = Boolean(options?.visualizationPlayback && troubleModel && options?.ignorePhysics);
  const split = ignorePhysics
    ? { thickness01: 0.5, cueRetain: 1, objectTransfer: 0 }
    : troubleModel
      ? computeTroubleThicknessSplit(data.isBankShot ?? false, data.thicknessOffsetX)
      : computeThicknessCollisionSplitFromSolution(data.isBankShot ?? false, data.thicknessOffsetX);
  const ballSpeedVal = data.ballSpeed ?? 3;
  const totalMovablePx = troubleModel ? troubleTotalMovableDistancePx(rect, ballSpeedVal) : undefined;
  const V0 = !ignorePhysics ? getCuePlayableDistanceFromBallSpeed(rect, ballSpeedVal) : 0;
  const L = split.objectTransfer;
  const remainingAfterPre =
    !ignorePhysics &&
    troubleModel &&
    options?.visualizationPlayback &&
    typeof options?.playbackRemainingAfterPrePx === "number" &&
    Number.isFinite(options.playbackRemainingAfterPrePx)
      ? Math.max(0, options.playbackRemainingAfterPrePx)
      : undefined;
  const objectPlayablePx =
    !ignorePhysics && troubleModel && options?.visualizationPlayback
      ? (remainingAfterPre ?? V0) * L
      : undefined;
  const strokeTotalPowerReferencePx =
    ignorePhysics
      ? undefined
      : troubleModel
        ? totalMovablePx
        : computeStrokeTotalPowerReferencePx(rect, moveParams);
  const physicsMoveDistancePx = computeObjectMoveDistancePx(rect, moveParams);
  const moveDistancePx = ignorePhysics
    ? pathLengthPx
    : options?.visualizationPlayback
    ? troubleModel
      ? Math.min(pathLengthPx, objectPlayablePx ?? 0)
      : pathLengthPx
    : physicsMoveDistancePx;
  if (
    !ignorePhysics &&
    options?.visualizationPlayback &&
    troubleModel &&
    isTroublePlaybackVerboseLogEnabled()
  ) {
    console.debug("[trouble-playback:object-plan]", {
      objectPostAppliedPx: moveDistancePx,
    });
  } else if (ignorePhysics && isTroublePlaybackVerboseLogEnabled()) {
    console.debug("[trouble-playback:path-only]", {
      ignorePhysics: true,
      appliedPx: pathLengthPx,
      pathLength: pathLengthPx,
    });
  }
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const objectCurveDampingPlan =
    options?.visualizationPlayback &&
    !troubleModel &&
    typed &&
    typed.length === pts.length - 1 &&
    spotEndVertexIndices &&
    spotEndVertexIndices.length === typed.length
      ? computeObjectPlaybackSegmentDampingPlan(
          poly,
          polyStraight,
          typed,
          spotEndVertexIndices,
          rect,
          options.objectPathCurveControls,
          options.objectPathCurveNodes
        )
      : null;
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
    spotEndVertexIndices,
    playbackObjectPlayableDistancePx: objectPlayablePx,
    playbackEffectivePathCostPx: objectCurveDampingPlan?.effectivePathCostPx,
    playbackLogicalSegmentPhysicalLengthsPx: objectCurveDampingPlan?.logicalSegmentPhysicalLengthsPx,
    playbackLogicalSegmentCurveCoefficients: objectCurveDampingPlan?.logicalSegmentCurveCoefficients,
    playbackCurveDampingApplied: Boolean(objectCurveDampingPlan && objectCurveDampingPlan.curveSegmentCount > 0),
    playbackCurveDampingMeanCoefficient: objectCurveDampingPlan?.meanCurveCoefficient,
    playbackCurveDampingCurveSegmentCount: objectCurveDampingPlan?.curveSegmentCount,
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

  const polyStraight = objectReflectionPolylineNormalized(objectStartNorm, pts, typed, rect, options);
  let poly = polyStraight;
  let spotEndVertexIndices: number[] | undefined = base.spotEndVertexIndices;
  const hasObjectCurveForPlayback =
    (options?.objectPathCurveControls?.length ?? 0) > 0 || (options?.objectPathCurveNodes?.length ?? 0) > 0;
  if (
    options?.visualizationPlayback &&
    typed &&
    typed.length === pts.length - 1 &&
    hasObjectCurveForPlayback
  ) {
    const curved = buildObjectCurvedPlaybackPolyline(
      polyStraight,
      typed,
      options.objectPathCurveControls,
      options.objectPathCurveNodes
    );
    poly = curved.vertices;
    spotEndVertexIndices = curved.spotEndVertexIndices;
  } else if (options?.visualizationPlayback && typed && typed.length === pts.length - 1) {
    spotEndVertexIndices = typed.map((_, i) => i + 1);
  }

  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const troubleModel = Boolean(options?.troublePlaybackModel);
  const ignorePhysics = Boolean(options?.visualizationPlayback && troubleModel && options?.ignorePhysics);
  const split = ignorePhysics
    ? { thickness01: 0.5, cueRetain: 1, objectTransfer: 0 }
    : troubleModel
      ? computeTroubleThicknessSplit(data.isBankShot ?? false, data.thicknessOffsetX)
      : computeThicknessCollisionSplitFromSolution(data.isBankShot ?? false, data.thicknessOffsetX);
  const ballSpeedVal = data.ballSpeed ?? 3;
  const V0 = !ignorePhysics ? getCuePlayableDistanceFromBallSpeed(rect, ballSpeedVal) : 0;
  const L = split.objectTransfer;
  const remainingAfterPre =
    !ignorePhysics &&
    troubleModel &&
    options?.visualizationPlayback &&
    typeof options?.playbackRemainingAfterPrePx === "number" &&
    Number.isFinite(options.playbackRemainingAfterPrePx)
      ? Math.max(0, options.playbackRemainingAfterPrePx)
      : undefined;
  const objectPlayablePx =
    !ignorePhysics && troubleModel && options?.visualizationPlayback
      ? (remainingAfterPre ?? V0) * L
      : undefined;
  const moveDistancePx = ignorePhysics
    ? pathLengthPx
    : options?.visualizationPlayback
    ? troubleModel
      ? Math.min(pathLengthPx, objectPlayablePx ?? 0)
      : pathLengthPx
    : base.moveDistancePx;
  const effectiveTravelPx = Math.min(moveDistancePx, pathLengthPx);
  const objectCurveDampingPlanWithStart =
    options?.visualizationPlayback &&
    !troubleModel &&
    typed &&
    typed.length === pts.length - 1 &&
    spotEndVertexIndices &&
    spotEndVertexIndices.length === typed.length
      ? computeObjectPlaybackSegmentDampingPlan(
          poly,
          polyStraight,
          typed,
          spotEndVertexIndices,
          rect,
          options.objectPathCurveControls,
          options.objectPathCurveNodes
        )
      : null;
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
    spotEndVertexIndices,
    playbackObjectPlayableDistancePx: objectPlayablePx,
    playbackEffectivePathCostPx: objectCurveDampingPlanWithStart?.effectivePathCostPx,
    playbackLogicalSegmentPhysicalLengthsPx: objectCurveDampingPlanWithStart?.logicalSegmentPhysicalLengthsPx,
    playbackLogicalSegmentCurveCoefficients: objectCurveDampingPlanWithStart?.logicalSegmentCurveCoefficients,
    playbackCurveDampingApplied: Boolean(objectCurveDampingPlanWithStart && objectCurveDampingPlanWithStart.curveSegmentCount > 0),
    playbackCurveDampingMeanCoefficient: objectCurveDampingPlanWithStart?.meanCurveCoefficient,
    playbackCurveDampingCurveSegmentCount: objectCurveDampingPlanWithStart?.curveSegmentCount,
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
  const W = plan.playbackEffectivePathCostPx;
  const lens = plan.playbackLogicalSegmentPhysicalLengthsPx;
  const coeffs = plan.playbackLogicalSegmentCurveCoefficients;
  if (
    W != null &&
    lens != null &&
    coeffs != null &&
    lens.length > 0 &&
    lens.length === coeffs.length
  ) {
    return sampleMotionAlongPathWithEffectiveCost(
      plan.polylineNormalized,
      plan.pathLengthPx,
      plan.moveDistancePx,
      progress01,
      rect,
      W,
      lens,
      coeffs
    );
  }
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
  const W = plan.playbackEffectivePathCostPx;
  const lens = plan.playbackLogicalSegmentPhysicalLengthsPx;
  const coeffs = plan.playbackLogicalSegmentCurveCoefficients;
  if (
    W != null &&
    lens != null &&
    coeffs != null &&
    lens.length > 0 &&
    lens.length === coeffs.length
  ) {
    return sampleMotionAlongPathWithEffectiveCost(
      plan.polylineNormalized,
      plan.pathLengthPx,
      plan.moveDistancePx,
      progress01,
      rect,
      W,
      lens,
      coeffs
    );
  }
  return sampleMotionAlongPath(
    plan.polylineNormalized,
    plan.pathLengthPx,
    plan.moveDistancePx,
    progress01,
    rect
  );
}
