/**
 * 경로 기반 이동 — 기하만 담당 (길이·거리만큼 보간).
 * 물리 엔진 없음. 픽셀 거리는 플레이필드 직교 좌표 기준.
 * 샘플된 정규화 좌표는 {@link clampBallToPlayfield}로 보정해 쿠션(0/1) 근처에서도 공 원이 레일 밖으로 나가지 않게 함.
 */
import {
  clampBallToPlayfield,
  normalizedToPixel,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";

export interface NormPoint {
  x: number;
  y: number;
}

/** 정규화 꼭짓점 순서대로 폴리라인 (수구→스팟1→…) */
export function polylineSegmentLengthsPx(vertices: NormPoint[], rect: PlayfieldRect): number[] {
  if (vertices.length < 2) return [];
  const lengths: number[] = [];
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = normalizedToPixel(vertices[i].x, vertices[i].y, rect);
    const b = normalizedToPixel(vertices[i + 1].x, vertices[i + 1].y, rect);
    lengths.push(Math.hypot(b.px - a.px, b.py - a.py));
  }
  return lengths;
}

export function polylineTotalLengthPx(vertices: NormPoint[], rect: PlayfieldRect): number {
  return polylineSegmentLengthsPx(vertices, rect).reduce((s, l) => s + l, 0);
}

function withBallCenterClampedToPlayfield(
  norm: NormPoint,
  rect: PlayfieldRect
): { x: number; y: number; normalized: NormPoint } {
  const n = clampBallToPlayfield(norm.x, norm.y, rect);
  const { px, py } = normalizedToPixel(n.x, n.y, rect);
  return { x: px, y: py, normalized: n };
}

export interface PositionAlongPathResult {
  x: number;
  y: number;
  /** 정규화 좌표 (플레이필드 0..1) */
  normalized: NormPoint;
  /** 이번에 따라간 폴리라인 위 거리(px) */
  distanceAlongPathPx: number;
  /** 경로 전체 길이에 도달했는지 (이동한 거리 ≥ 유효 이동거리이고 경로 끝) */
  atPolylineEnd: boolean;
}

/**
 * 폴리라인 위에서 시작점에서부터 distancePx 만큼 떨어진 위치.
 * distancePx가 총 길이 이상이면 마지막 꼭짓점.
 */
export function positionOnPolylineAtDistancePx(
  vertices: NormPoint[],
  distancePx: number,
  rect: PlayfieldRect
): PositionAlongPathResult {
  if (vertices.length === 0) {
    const c = withBallCenterClampedToPlayfield({ x: 0, y: 0 }, rect);
    return { ...c, distanceAlongPathPx: 0, atPolylineEnd: true };
  }
  if (vertices.length === 1) {
    const c = withBallCenterClampedToPlayfield(vertices[0], rect);
    return {
      x: c.x,
      y: c.y,
      normalized: c.normalized,
      distanceAlongPathPx: 0,
      atPolylineEnd: true,
    };
  }
  const lengths = polylineSegmentLengthsPx(vertices, rect);
  const total = lengths.reduce((s, l) => s + l, 0);
  const clamped = Math.max(0, Math.min(distancePx, total));
  let remaining = clamped;
  let i = 0;
  for (; i < lengths.length; i++) {
    const len = lengths[i];
    if (remaining <= len + 1e-9) {
      const t = len < 1e-9 ? 1 : remaining / len;
      const nx = vertices[i].x + t * (vertices[i + 1].x - vertices[i].x);
      const ny = vertices[i].y + t * (vertices[i + 1].y - vertices[i].y);
      const { px, py } = normalizedToPixel(nx, ny, rect);
      return {
        x: px,
        y: py,
        normalized: { x: nx, y: ny },
        distanceAlongPathPx: clamped,
        atPolylineEnd: clamped >= total - 1e-6,
      };
    }
    remaining -= len;
  }
  const last = vertices[vertices.length - 1]!;
  const c = withBallCenterClampedToPlayfield(last, rect);
  return {
    x: c.x,
    y: c.y,
    normalized: c.normalized,
    distanceAlongPathPx: total,
    atPolylineEnd: true,
  };
}

/**
 * 이동 거리(moveDistancePx)와 경로 길이(pathLengthPx) 중 짧은 쪽까지를 0..1 진행률로 샘플.
 * - progress01=1 → 실제로는 min(moveDistancePx, pathLengthPx) 만큼 이동한 위치
 */
export function sampleMotionAlongPath(
  vertices: NormPoint[],
  pathLengthPx: number,
  moveDistancePx: number,
  progress01: number,
  rect: PlayfieldRect
): PositionAlongPathResult {
  const effectiveCap = Math.min(Math.max(0, moveDistancePx), Math.max(0, pathLengthPx));
  const distanceAlong = Math.max(0, Math.min(1, progress01)) * effectiveCap;
  return positionOnPolylineAtDistancePx(vertices, distanceAlong, rect);
}
