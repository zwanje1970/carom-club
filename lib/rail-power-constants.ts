/**
 * 볼스피드 레일 표시 세기 (UI·저장 메타에만 사용 가능한 값)
 * 실제 이동거리에는 `computeInternalRailPower` 사용
 */
export const RAIL_DISPLAY_POWER = {
  1: 28,
  2: 43,
  3: 57,
  4: 69,
  5: 80,
} as const;

/** 애니메이션·내부 계산 전용 보정 (UI에 노출하지 않음) */
export const RAIL_ANIMATION_CORRECTION = {
  1: 1.1,
  2: 1.08,
  3: 1.06,
  4: 1.04,
  5: 1.02,
} as const;

export type RailCount = 1 | 2 | 3 | 4 | 5;

/**
 * speedLevel 1~10 → UI 레일 구간 (Trouble/Nangu 볼스피드 버튼과 동일)
 * 1~3: 1레일대, 4~5: 2레일대 … 9~10: 4~5레일대
 */
export function speedLevelToRailCount(speedLevel: number | undefined): RailCount {
  const s = Math.max(1, Math.min(10, Math.round(speedLevel ?? 5)));
  const bySpeed: readonly RailCount[] = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];
  return bySpeed[s - 1];
}

/** 레거시 speed 1~5 → 레일 번호 */
export function legacySpeedToRailCount(speed: number | undefined): RailCount {
  const r = Math.max(1, Math.min(5, Math.round(speed ?? 3)));
  return r as RailCount;
}

/**
 * 내부 세기 = 표시 세기 × 레일별 보정 (애니메이션 거리 산출용)
 */
export function computeInternalRailPower(railCount: RailCount): number {
  return RAIL_DISPLAY_POWER[railCount] * RAIL_ANIMATION_CORRECTION[railCount];
}

/** UI용 표시 숫자 (28, 43, …) — speedLevel만 알 때 */
export function getRailDisplayPowerForSpeedLevel(speedLevel: number | undefined): number {
  const rail = speedLevelToRailCount(speedLevel);
  return RAIL_DISPLAY_POWER[rail];
}
