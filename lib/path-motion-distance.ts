/**
 * 경로 이동 거리 — 세기(레일 표시값 28~80 + 내부 보정)·쿠션 경로·두께(충돌 분배)
 *
 * strokeTotalPowerPx = baseFromInternalPower × cushionPathMultiplier
 * cueMovePx = strokeTotalPowerPx × cueRetain(thickness)
 * objectMovePx = strokeTotalPowerPx × objectTransfer(thickness)
 *
 * internalPower = railDisplayPower[rail] × railAnimationCorrection[rail]
 *
 * 세기 레일: `ballSpeed`(1.0~5.0) > `speedLevel`(1~10) > `speed`(1~5)
 */
import { getPlayfieldLongSide, type PlayfieldRect } from "@/lib/billiard-table-constants";
import { ballSpeedToRailCount } from "@/lib/ball-speed-constants";
import {
  computeInternalRailPower,
  legacySpeedToRailCount,
  speedLevelToRailCount,
  type RailCount,
} from "@/lib/rail-power-constants";
import { computeThicknessCollisionSplitFromSolution } from "@/lib/thickness-power-split";

/** 플레이필드 긴 변 대비 이동 거리 비율 (최소/최대 internalPower 기준 선형) */
const BASE_DISTANCE_MAX_RATIO = 0.42;
const BASE_DISTANCE_MIN_RATIO = 0.06;

/** 경로상 쿠션 스팟 개수에 따른 추가 거리 보정 (레일 보정과 별개) */
const CUSHION_PATH_MULT_PER_HIT = 0.07;
const CUSHION_PATH_MULT_MAX = 1.55;

export interface MoveDistanceParams {
  /** 볼 스피드 1.0~5.0(0.5 단계) — 있으면 최우선으로 레일 매핑 */
  ballSpeed?: number;
  /** 세기 1~10 → 레일 구간 */
  speedLevel?: number;
  /** 레거시 1~5 → 레일 번호 직접 */
  speed?: number;
  /** 쿠션 스팟 개수(수구 경로 등) */
  cushionCount: number;
  /** 뱅크면 두께 분배 중립(0.5/0.5) */
  isBankShot?: boolean;
  /** 비뱅크 두께 0..1 (에디터 offset → thickness-power-split) */
  thicknessOffsetX?: number;
}

function resolveRailCount(p: MoveDistanceParams): RailCount {
  if (p.ballSpeed != null && !Number.isNaN(p.ballSpeed)) {
    return ballSpeedToRailCount(p.ballSpeed);
  }
  if (p.speedLevel != null) {
    return speedLevelToRailCount(p.speedLevel);
  }
  if (p.speed != null) {
    return legacySpeedToRailCount(p.speed);
  }
  return speedLevelToRailCount(5);
}

/** 이동 거리·애니메이션 시간에 쓰는 세기 레일(1~5) */
export function resolveMoveDistanceRailCount(params: MoveDistanceParams): RailCount {
  return resolveRailCount(params);
}

/**
 * 레일 표시 세기(28~80)에 내부 보정을 곱한 값으로 플레이필드 이동 거리 스케일 산출
 */
export function computeBaseDistanceFromRailPx(rect: PlayfieldRect, railCount: RailCount): number {
  const longSide = getPlayfieldLongSide(rect);
  const internalPower = computeInternalRailPower(railCount);
  const minI = computeInternalRailPower(1);
  const maxI = computeInternalRailPower(5);
  const t = (internalPower - minI) / (maxI - minI || 1);
  const clampedT = Math.max(0, Math.min(1, t));
  const ratio =
    BASE_DISTANCE_MIN_RATIO + (BASE_DISTANCE_MAX_RATIO - BASE_DISTANCE_MIN_RATIO) * clampedT;
  return longSide * ratio;
}

/** @deprecated 이름 혼동 방지 — `computeCushionPathDistanceMultiplier` 사용 */
export function computeRailMultiplier(cushionCount: number): number {
  return computeCushionPathDistanceMultiplier(cushionCount);
}

export function computeCushionPathDistanceMultiplier(cushionCount: number): number {
  const c = Math.max(0, cushionCount);
  return Math.min(CUSHION_PATH_MULT_MAX, 1 + CUSHION_PATH_MULT_PER_HIT * c);
}

/**
 * @deprecated 두께는 `lib/thickness-power-split`의 cueRetain / objectTransfer로 분배한다.
 * 레거시 호환: 예전처럼 단일 배율이 필요하면 1을 반환하고, 거리는 `computeCueMoveDistancePx` 등을 사용.
 */
export function computeThicknessMultiplier(_isBankShot: boolean | undefined, _thicknessOffsetX: number | undefined): number {
  return 1;
}

/**
 * 스트로크 총 참조 힘(px) — 레일·쿠션까지 반영. 두께 분배 전.
 */
export function computeStrokeTotalPowerReferencePx(rect: PlayfieldRect, params: MoveDistanceParams): number {
  const railCount = resolveRailCount(params);
  const base = computeBaseDistanceFromRailPx(rect, railCount);
  const cushionPath = computeCushionPathDistanceMultiplier(params.cushionCount);
  return base * cushionPath;
}

/**
 * 수구 경로 이동 의도 거리(px) = totalPower × cueRetain(thickness) × (이미 total에 포함된 쿠션)
 */
export function computeCueMoveDistancePx(rect: PlayfieldRect, params: MoveDistanceParams): number {
  const total = computeStrokeTotalPowerReferencePx(rect, params);
  const { cueRetain } = computeThicknessCollisionSplitFromSolution(
    params.isBankShot ?? false,
    params.thicknessOffsetX
  );
  return total * cueRetain;
}

/**
 * 1목적구 경로 이동 의도 거리(px) = totalPower × objectTransfer(thickness)
 */
export function computeObjectMoveDistancePx(rect: PlayfieldRect, params: MoveDistanceParams): number {
  const total = computeStrokeTotalPowerReferencePx(rect, params);
  const { objectTransfer } = computeThicknessCollisionSplitFromSolution(
    params.isBankShot ?? false,
    params.thicknessOffsetX
  );
  return total * objectTransfer;
}

/**
 * @deprecated `computeCueMoveDistancePx` 사용 (두께는 유지/전달 계수로 분배됨)
 */
export function computeMoveDistancePx(rect: PlayfieldRect, params: MoveDistanceParams): number {
  return computeCueMoveDistancePx(rect, params);
}
