/**
 * 경로 애니메이션 재생 시간 — 시연 후 튜닝용 설정 객체
 * (코드 곳곳에 초 단위 리터럴을 박지 않고 이 설정을 조정)
 */
import type { RailCount } from "@/lib/rail-power-constants";

/**
 * 기본 튜닝값. 런타임에 다른 객체를 넘겨 덮어쓸 수 있음.
 */
export const PATH_ANIMATION_TIMING = {
  /** 레일 1(약한 세기 구간) 기준 기본 스트로크 재생 시간(초) */
  baseDurationSecAtRail1: 1,
  /** 레일 번호가 1보다 클 때, 레일당 추가 시간(초) */
  extraDurationSecPerRailAbove1: 0.22,
  /**
   * UX 보조: 예) Trouble「경로 시연」1목 숨김 유지 시간에 가산 (레일 기준 ms 이후 여유)
   * — 스트로크 물리 시간과 별도 튜닝
   */
  pathPreviewDemoPaddingMs: 1200,
} as const;

export type PathAnimationTimingConfig = typeof PATH_ANIMATION_TIMING;

/**
 * 세기 레일(1~5)에 따른 스트로크 재생 시간(초)
 */
export function computeStrokeAnimationDurationSec(
  powerRailCount: RailCount,
  config: PathAnimationTimingConfig = PATH_ANIMATION_TIMING
): number {
  const extraRails = Math.max(0, powerRailCount - 1);
  return config.baseDurationSecAtRail1 + extraRails * config.extraDurationSecPerRailAbove1;
}

export function computeStrokeAnimationDurationMs(
  powerRailCount: RailCount,
  config: PathAnimationTimingConfig = PATH_ANIMATION_TIMING
): number {
  return Math.round(computeStrokeAnimationDurationSec(powerRailCount, config) * 1000);
}

/** 시연·숨김 UX 등: 스트로크 시간 + 패딩 */
export function computePathPreviewDemoHoldMs(
  powerRailCount: RailCount,
  config: PathAnimationTimingConfig = PATH_ANIMATION_TIMING
): number {
  return computeStrokeAnimationDurationMs(powerRailCount, config) + config.pathPreviewDemoPaddingMs;
}
