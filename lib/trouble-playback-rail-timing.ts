/**
 * 난구 재생 시간 보조 유틸.
 * - 거리 모델과 분리하여 "벽시계 시간 <-> 경로 누적거리"만 담당.
 */

/** railSpeed 정수 1~5 → 변(세그먼트)당 재생 시간(초) */
export function timePerRailSecFromRailSpeed(railSpeed: number): number {
  const r = Math.max(1, Math.min(5, Math.round(Number(railSpeed) || 3)));
  return 1.15 - 0.15 * r;
}

export function clampTroubleRailSpeed(railSpeed: number | undefined | null): number {
  return Math.max(1, Math.min(5, Math.round(Number(railSpeed) || 3)));
}

/** railCount(1~5)가 클수록 더 빠르게 재생되도록 속도 배수 적용 */
export function troublePlaybackSpeedFactorFromRailCount(railCount: number): number {
  const r = Math.max(1, Math.min(5, Math.round(Number(railCount) || 3)));
  const table: Record<number, number> = {
    1: 1.0,
    2: 1.25,
    3: 1.5,
    4: 1.75,
    5: 2.0,
  };
  return table[r] ?? 1.0;
}

/**
 * 각 변에 동일 timePerRailMs가 걸릴 때, distancePx까지 진행하는 데 걸리는 시간(ms).
 */
export function timeMsForDistanceAlongEqualEdgeTimes(
  distancePx: number,
  segmentLensPx: readonly number[],
  timePerRailMs: number
): number {
  if (segmentLensPx.length === 0 || distancePx <= 0) return 0;
  const T = Math.max(1e-6, timePerRailMs);
  let t = 0;
  let acc = 0;
  const target = Math.max(0, distancePx);
  for (let i = 0; i < segmentLensPx.length; i++) {
    const len = segmentLensPx[i]!;
    if (acc + len >= target - 1e-6) {
      const frac = len > 1e-9 ? (target - acc) / len : 1;
      t += frac * T;
      return t;
    }
    t += T;
    acc += len;
  }
  return t;
}

/**
 * wallMs 경과 시 각 변 동일 시간 기준으로 따라간 누적 거리(px), 전체 변 길이 합 이하.
 */
export function distancePxAfterTimeMsAlongEqualEdgeTimes(
  wallMs: number,
  segmentLensPx: readonly number[],
  timePerRailMs: number
): number {
  if (segmentLensPx.length === 0 || wallMs <= 0) return 0;
  const T = Math.max(1e-6, timePerRailMs);
  let dist = 0;
  let tRemain = wallMs;
  for (let i = 0; i < segmentLensPx.length; i++) {
    const len = segmentLensPx[i]!;
    if (tRemain <= T + 1e-9) {
      dist += (tRemain / T) * len;
      return dist;
    }
    tRemain -= T;
    dist += len;
  }
  return dist;
}
