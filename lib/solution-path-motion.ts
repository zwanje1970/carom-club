/**
 * 해법(NanguSolutionData) + 배치 → 경로 폴리라인 + 이동 계획 (시각화용)
 * - 경로 계산과 이동 거리 계산은 하위 모듈에 위임
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, NanguPathPoint, NanguSolutionData, NanguSolutionPath } from "@/lib/nangu-types";
import {
  computePolylinePlaybackDurationMs,
  computeStrokeAnimationDurationMs,
  computeStrokeAnimationDurationSec,
} from "@/lib/path-animation-timing";
import {
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
import { computeThicknessCollisionSplitFromSolution } from "@/lib/thickness-power-split";

export type { NormPoint, PositionAlongPathResult };

/** `visualizationPlayback`: 경로 시연 — 마지막 스팟까지 전 구간 이동 + 플레이필드 긴 변 왕복 기준 재생 시간 */
export type BuildPathMotionPlanOptions = {
  visualizationPlayback?: boolean;
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
  /** 수구 꼭짓점 포함 — 감속·시연 시간은 스팟 간만이 아니라 수구→첫 스팟→…→마지막 스팟 총거리 */
  const poly = verticesFromCueAndSpots(cue, spots);
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

  const poly = pts.map((p) => ({ x: p.x, y: p.y }));
  const pathLengthPx = polylineTotalLengthPx(poly, rect);
  const typed: NanguPathPoint[] | undefined = rp.pointsWithType;
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
