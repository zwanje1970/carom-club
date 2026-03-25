/**
 * Core timing math:
 * - Converts between elapsed wall-clock time and traveled distance
 *   when each path edge consumes equal time.
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

/**
 * 총 재생 시간을 세그먼트 **길이 비율**로 나눔 → 경로를 따라 **등속(거리/시간 일정)** 에 가깝게 보임.
 * (세그먼트마다 동일 시간을 쓰면 짧은 구간은 느리고 긴 구간은 빨라 보임)
 */
export function buildSegmentTimesMsProportionalToLength(
  totalMs: number,
  segmentLensPx: readonly number[]
): number[] {
  if (segmentLensPx.length === 0) return [];
  const sumLen = segmentLensPx.reduce((a, b) => a + b, 0);
  if (sumLen <= 1e-9) {
    const n = segmentLensPx.length;
    const per = totalMs / Math.max(1, n);
    return segmentLensPx.map(() => per);
  }
  return segmentLensPx.map((len) => (totalMs * len) / sumLen);
}

export function timeMsForDistanceAlongVariableEdgeTimes(
  distancePx: number,
  segmentLensPx: readonly number[],
  segmentTimesMs: readonly number[]
): number {
  if (segmentLensPx.length === 0 || distancePx <= 0) return 0;
  let t = 0;
  let acc = 0;
  const target = Math.max(0, distancePx);
  const n = segmentLensPx.length;
  for (let i = 0; i < n; i++) {
    const len = segmentLensPx[i]!;
    const T = Math.max(1e-9, segmentTimesMs[i] ?? 0);
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

export function distancePxAfterTimeMsAlongVariableEdgeTimes(
  wallMs: number,
  segmentLensPx: readonly number[],
  segmentTimesMs: readonly number[]
): number {
  if (segmentLensPx.length === 0 || wallMs <= 0) return 0;
  let dist = 0;
  let tRemain = wallMs;
  const n = segmentLensPx.length;
  for (let i = 0; i < n; i++) {
    const len = segmentLensPx[i]!;
    const T = Math.max(1e-9, segmentTimesMs[i] ?? 0);
    if (tRemain <= T + 1e-9) {
      dist += (tRemain / T) * len;
      return dist;
    }
    tRemain -= T;
    dist += len;
  }
  return dist;
}
