/**
 * 경로 애니메이션 재생 시간 — 시연 후 튜닝용 설정 객체
 * (코드 곳곳에 초 단위 리터럴을 박지 않고 이 설정을 조정)
 */
import { getPlayfieldLongSide, type PlayfieldRect } from "@/lib/billiard-table-constants";
import type { RailCount } from "@/lib/rail-power-constants";

/**
 * 기본 튜닝값. 런타임에 다른 객체를 넘겨 덮어쓸 수 있음.
 */
export const PATH_ANIMATION_TIMING = {
  /**
   * 경로 시연: 플레이필드 **긴 변 L**(쿠션 끝~끝, `getPlayfieldLongSide`) **편도** 거리를
   * 이 시간(ms)에 **등속**으로 통과하는 속도를 기준으로, 폴리라인 총길이만큼 재생 시간을 비례함.
   * - 편도 L → `playbackLongEdgeOneWayMs`(기본 3000ms)
   * - 왕복 2L → 6000ms
   * - 예: 경로 총길이 = 4L → 4 × 3000ms = 12s
   */
  playbackLongEdgeOneWayMs: 3000,
  /** 시연 경로가 극단적으로 짧을 때 최소 재생 ms */
  playbackMinDurationMs: 250,
  /** 시연 경로가 매우 길 때 상한 ms (UX) */
  playbackMaxDurationMs: 120_000,
  /** 레일 1(약한 세기 구간) 기준 기본 스트로크 재생 시간(초) */
  baseDurationSecAtRail1: 1,
  /** 레일 번호가 1보다 클 때, 레일당 추가 시간(초) */
  extraDurationSecPerRailAbove1: 0.22,
  /**
   * UX 보조: 예) Trouble「경로 시연」1목 숨김 유지 시간에 가산 (레일 기준 ms 이후 여유)
   * — 스트로크 물리 시간과 별도 튜닝
   */
  pathPreviewDemoPaddingMs: 1200,
  /** 수구 시연: 스팟(세그먼트 끝)마다 멈춤 — 총 이동(감속) 시간과 별도 가산 */
  cuePlaybackSpotPauseMs: 20,
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

/**
 * 경로 시연: 벽시계 시간 비율 t∈[0,1]에 대해 **경로상 진행률** p∈[0,1].
 * 순간 속도(경로 거리/시간)가 t에 대해 **100%→0%로 선형 감소**하고 끝에서 0이 되게 함.
 * 즉 v(t) ∝ (1−t) → 적분으로 p(t) = 2t − t² = 1 − (1−t)² (감속 정지).
 */
export function cuePathDecelerationProgress(linearT: number): number {
  const t = Math.max(0, Math.min(1, linearT));
  return 1 - (1 - t) * (1 - t);
}

/**
 * `cuePathDecelerationProgress(t)` 의 역함수: 경로 진행률 p∈[0,1] → 시간 비율 t∈[0,1].
 * p = 1-(1-t)² ⇒ t = 1-√(1-p)
 */
export function inverseCuePathDecelerationProgress(pathProgress01: number): number {
  const p = Math.max(0, Math.min(1, pathProgress01));
  return 1 - Math.sqrt(1 - p);
}

/**
 * 누적 **거리 비율** F∈[0,1]에 대응하는 감속 시연상의 이동 경과 시간 비율 τ/T (0..1).
 */
export function cuePlaybackTauFractionAtCumulativeDistance(F: number): number {
  return inverseCuePathDecelerationProgress(F);
}

/** 시연·숨김 UX 등: 스트로크 시간 + 패딩 */
export function computePathPreviewDemoHoldMs(
  powerRailCount: RailCount,
  config: PathAnimationTimingConfig = PATH_ANIMATION_TIMING
): number {
  return computeStrokeAnimationDurationMs(powerRailCount, config) + config.pathPreviewDemoPaddingMs;
}

/**
 * 플레이필드 긴 변 길이 L(px) = `getPlayfieldLongSide(rect)`.
 * 편도 L를 `playbackLongEdgeOneWayMs`에 주행하는 등속을 기준으로 `pathLengthPx` 재생 시간:
 * `durationMs = playbackLongEdgeOneWayMs × pathLengthPx / L`
 * (경로가 4L이면 4×편도 시간, 예: 4×2500ms = 10s)
 */
export function computePolylinePlaybackDurationMs(
  pathLengthPx: number,
  rect: PlayfieldRect,
  config: PathAnimationTimingConfig = PATH_ANIMATION_TIMING
): number {
  const longEdgePx = Math.max(getPlayfieldLongSide(rect), 1e-6);
  const raw =
    (config.playbackLongEdgeOneWayMs * Math.max(0, pathLengthPx)) / longEdgePx;
  const minMs = config.playbackMinDurationMs;
  const maxMs = config.playbackMaxDurationMs;
  return Math.round(Math.min(maxMs, Math.max(minMs, raw)));
}

/**
 * 수구 시연 벽시계(ms) → **이동**에만 쓰인 경과 ms.
 * 각 세그먼트 종료 직후 `pauseMs` 동안 τ는 증가하지 않아 수구가 스팟에서 멈춘 것처럼 보임.
 * @deprecated `cuePlaybackMovementTauMsFromWallMs` + 감속 곡선 기준 꼭짓점 τ 사용 권장
 */
export function cuePlaybackMovementElapsedMs(
  wallMs: number,
  segmentMoveMs: readonly number[],
  pauseMs: number
): number {
  const totalMove = segmentMoveMs.reduce((a, b) => a + b, 0);
  if (totalMove <= 0) return 0;
  let w = 0;
  let tau = 0;
  for (let i = 0; i < segmentMoveMs.length; i++) {
    const md = segmentMoveMs[i]!;
    if (wallMs <= w + md) {
      return Math.min(totalMove, tau + Math.max(0, wallMs - w));
    }
    w += md;
    tau += md;
    if (wallMs <= w + pauseMs) {
      return tau;
    }
    w += pauseMs;
  }
  return totalMove;
}

/**
 * 총 이동 시간 T에 **전역 감속** `cuePathDecelerationProgress`가 적용될 때,
 * 스팟(꼭짓점)마다 `pauseMs` 동안 `τ`만 멈춤(벽시계는 더 감).
 * `tauAtVertices`[k] = 수구→k번째 스팟까지의 **경로 거리 비율**에 대응하는 감속 시계상 이동 경과 ms.
 * `tauAtVertices.length === numSpots + 1`, `tauAtVertices[0]=0`, `tauAtVertices[numSpots]=T`.
 */
export function cuePlaybackMovementTauMsFromWallMs(
  wallMs: number,
  tauAtVertices: readonly number[],
  pauseMs: number
): number {
  const n = tauAtVertices.length - 1;
  if (n <= 0) return 0;
  const T = tauAtVertices[n]!;
  if (T <= 0) return 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    const tauStart = tauAtVertices[i]!;
    const tauEnd = tauAtVertices[i + 1]!;
    const md = tauEnd - tauStart;
    if (wallMs <= w + md) {
      return tauStart + Math.max(0, wallMs - w);
    }
    w += md;
    if (wallMs <= w + pauseMs) {
      return tauEnd;
    }
    w += pauseMs;
  }
  return T;
}

/** 수구 시연 총 벽시간 = 이동 시간 + 스팟마다 pause */
export function cuePlaybackWallDurationWithSpotPausesMs(
  moveDurationMs: number,
  numSpots: number,
  pauseMs: number
): number {
  return moveDurationMs + pauseMs * Math.max(0, numSpots);
}
