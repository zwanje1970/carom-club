/**
 * 2차 베지어 곡선 샘플링·폴리라인 길이 (정규화 0~1).
 * 렌더·playback과 분리 — 후속 단계에서만 연결.
 */

import type { NormPoint } from "@/lib/path-motion-geometry";

/** `buildCurveSegmentPoints` 등에서 샘플 구간 수로 쓰는 기본값 (대략 20~40 권장 범위의 중간) */
export const DEFAULT_QUADRATIC_BEZIER_SEGMENTS = 32;

function clampSegmentCount(segments: number): number {
  if (!Number.isFinite(segments)) return DEFAULT_QUADRATIC_BEZIER_SEGMENTS;
  return Math.max(1, Math.floor(segments));
}

/**
 * Quadratic Bezier: P(t) = (1−t)²·start + 2(1−t)t·control + t²·end , t ∈ [0,1]
 * `segments` = 구간 개수 → 점은 `segments + 1`개 (양 끝 포함).
 */
export function sampleQuadraticBezierPoints(params: {
  start: NormPoint;
  control: NormPoint;
  end: NormPoint;
  segments: number;
}): NormPoint[] {
  const { start, control, end } = params;
  const n = clampSegmentCount(params.segments);
  const out: NormPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const w0 = u * u;
    const w1 = 2 * u * t;
    const w2 = t * t;
    out.push({
      x: w0 * start.x + w1 * control.x + w2 * end.x,
      y: w0 * start.y + w1 * control.y + w2 * end.y,
    });
  }
  return out;
}

/** 같은 좌표계에서 인접 점 사이 유클리드 거리 합 */
export function getPolylineLength(points: readonly NormPoint[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/**
 * 한 세그먼트(시작→끝)를 폴리라인 점열로 변환.
 * `curveNode` 없음 → [start, end]
 * 있음 → 2차 베지어를 `segments`등분 샘플 (기본 {@link DEFAULT_QUADRATIC_BEZIER_SEGMENTS})
 */
export function buildCurveSegmentPoints(params: {
  start: NormPoint;
  end: NormPoint;
  curveNode?: NormPoint | null;
  segments?: number;
}): NormPoint[] {
  const { start, end, curveNode } = params;
  const segments = params.segments ?? DEFAULT_QUADRATIC_BEZIER_SEGMENTS;
  if (curveNode == null) {
    return [start, end];
  }
  return sampleQuadraticBezierPoints({
    start,
    control: { x: curveNode.x, y: curveNode.y },
    end,
    segments,
  });
}
