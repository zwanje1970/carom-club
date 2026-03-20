/**
 * 볼 스피드 (1.0 ~ 5.0, 0.5 단계) — 거리·레일 매핑·레거시 필드 동기화
 */
import type { NanguSolutionData } from "@/lib/nangu-types";
import {
  RAIL_DISPLAY_POWER,
  type RailCount,
  legacySpeedToRailCount,
  speedLevelToRailCount,
} from "@/lib/rail-power-constants";

export const BALL_SPEED_STEP = 0.5 as const;
export const BALL_SPEED_MIN = 1.0 as const;
export const BALL_SPEED_MAX = 5.0 as const;

/** 사용 가능한 값 (고정 집합) */
export const BALL_SPEED_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0,
] as const;

export type BallSpeed = (typeof BALL_SPEED_OPTIONS)[number];

/**
 * 임의 수치를 허용 스텝으로 스냅 (범위 밖이면 클램프)
 */
export function normalizeBallSpeed(value: number | undefined | null): BallSpeed {
  if (value == null || Number.isNaN(value)) return 3.0;
  const clamped = Math.max(BALL_SPEED_MIN, Math.min(BALL_SPEED_MAX, value));
  const steps = Math.round((clamped - BALL_SPEED_MIN) / BALL_SPEED_STEP);
  const snapped = BALL_SPEED_MIN + steps * BALL_SPEED_STEP;
  const idx = Math.round((snapped - BALL_SPEED_MIN) / BALL_SPEED_STEP);
  return BALL_SPEED_OPTIONS[Math.max(0, Math.min(BALL_SPEED_OPTIONS.length - 1, idx))];
}

/**
 * 볼 스피드 → 레일 구간 (1~5). 인접한 0.5 단계 두 개가 같은 레일을 쓸 수 있음.
 * 인덱스 0,1→1레일 … 8→5레일
 */
export function ballSpeedToRailCount(ballSpeed: number): RailCount {
  const s = normalizeBallSpeed(ballSpeed);
  const idx = BALL_SPEED_OPTIONS.indexOf(s);
  const rail = Math.min(5, Math.floor(idx / 2) + 1) as RailCount;
  return rail;
}

/** UI·메타용 표시 세기 (28, 43, …) */
export function getRailDisplayPowerForBallSpeed(ballSpeed: number): number {
  const r = ballSpeedToRailCount(ballSpeed);
  return RAIL_DISPLAY_POWER[r];
}

/** 레일만 알 때 기본 볼 스피드 (레거시 데이터 마이그레이션용) */
export function defaultBallSpeedForRail(rail: RailCount): BallSpeed {
  const map: Record<RailCount, BallSpeed> = {
    1: 1.0,
    2: 2.0,
    3: 3.0,
    4: 4.0,
    5: 5.0,
  };
  return map[rail];
}

/** 저장용: 예전 speedLevel 1~10 대표값 */
export function ballSpeedToLegacySpeedLevel(ballSpeed: number): number {
  const rail = ballSpeedToRailCount(ballSpeed);
  const mid: Record<RailCount, number> = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10 };
  return mid[rail];
}

/** 저장용: 예전 speed 1~5 */
export function ballSpeedToLegacySpeed(ballSpeed: number): number {
  return ballSpeedToRailCount(ballSpeed);
}

export function initialBallSpeedFromSolution(
  data: Pick<NanguSolutionData, "ballSpeed" | "speedLevel" | "speed"> | undefined | null
): BallSpeed {
  if (!data) return 3.0;
  if (data.ballSpeed != null && !Number.isNaN(data.ballSpeed)) {
    return normalizeBallSpeed(data.ballSpeed);
  }
  if (data.speedLevel != null) {
    return defaultBallSpeedForRail(speedLevelToRailCount(data.speedLevel));
  }
  if (data.speed != null) {
    return defaultBallSpeedForRail(legacySpeedToRailCount(data.speed));
  }
  return 3.0;
}
