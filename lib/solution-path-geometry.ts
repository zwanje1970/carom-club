/**
 * 수구→첫 스팟 직선과 1목적구(원)의 접촉 시점 — 중심거리 = 2R 인 첫 교점
 * 1목은 수구를 제외한 두 공 중, 광선상 가장 먼저 맞는 공.
 * (난구 전체 규칙·쿠션 경로 등은 `lib/nangu-types.ts`, `lib/trouble-first-object-ball.ts` 참고)
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  getBallRadius,
  getPlayfieldLongSide,
  normalizedToPixel,
  pixelToNormalized,
} from "@/lib/billiard-table-constants";
import {
  ballLabeledNormForKey,
  getNonCueBallNorms,
  getSecondObjectBallKeyExclusive,
  type LabeledBallNorm,
  type NanguBallPlacement,
} from "@/lib/nangu-types";

function normToPx(x: number, y: number, rect: PlayfieldRect) {
  return normalizedToPixel(x, y, rect);
}

/**
 * 광선 C + t*d (t>=0, d 단위벡터) 와 원 (O, R) 의 가장 작은 양의 근 t
 */
function rayCircleSmallestPositiveT(
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  ox: number,
  oy: number,
  R: number
): number | null {
  const fx = cx - ox;
  const fy = cy - oy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  const eps = 1e-6;
  const candidates = [t1, t2].filter((t) => t >= eps);
  if (candidates.length === 0) return null;
  return Math.min(...candidates);
}

/**
 * 수구에서 첫 스팟 방향으로 진행할 때, **수구 제외 1목 후보 공들** 중 광선상 가장 먼저 맞는 공의 접촉점.
 */
export function cueFirstObjectHitAmongNormalized(
  cueNorm: { x: number; y: number },
  firstSpotNorm: { x: number; y: number },
  objectBalls: LabeledBallNorm[],
  rect: PlayfieldRect
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  if (objectBalls.length === 0) return null;
  const C = normToPx(cueNorm.x, cueNorm.y, rect);
  const P = normToPx(firstSpotNorm.x, firstSpotNorm.y, rect);
  let dx = P.px - C.px;
  let dy = P.py - C.py;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  dx /= len;
  dy /= len;
  const longSide = getPlayfieldLongSide(rect);
  const r = getBallRadius(longSide);
  const R = 2 * r;

  let bestT: number | null = null;
  let bestKey: LabeledBallNorm["key"] | null = null;
  for (const ob of objectBalls) {
    const O = normToPx(ob.x, ob.y, rect);
    const t = rayCircleSmallestPositiveT(C.px, C.py, dx, dy, O.px, O.py, R);
    if (t == null) continue;
    if (bestT == null || t < bestT) {
      bestT = t;
      bestKey = ob.key;
    }
  }
  if (bestT == null || bestKey == null) return null;
  const hitPx = C.px + bestT * dx;
  const hitPy = C.py + bestT * dy;
  return {
    collision: {
      x: (hitPx - rect.left) / rect.width,
      y: (hitPy - rect.top) / rect.height,
    },
    objectKey: bestKey,
  };
}

export function cueFirstObjectHitFromBallPlacement(
  cueNorm: { x: number; y: number },
  firstSpotNorm: { x: number; y: number },
  placement: NanguBallPlacement,
  rect: PlayfieldRect
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  return cueFirstObjectHitAmongNormalized(cueNorm, firstSpotNorm, getNonCueBallNorms(placement), rect);
}

/** 수구 폴리라인과 충돌점의 최대 허용 거리(px) — 스냅·표시 오차 허용 */
export const SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX = 24;

function distNormPointToSegmentPx(
  nx: number,
  ny: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rect: PlayfieldRect
): number {
  const p = normalizedToPixel(nx, ny, rect);
  const a = normalizedToPixel(ax, ay, rect);
  const b = normalizedToPixel(bx, by, rect);
  const dx = b.px - a.px;
  const dy = b.py - a.py;
  const len = Math.hypot(dx, dy) || 1e-6;
  let t = ((p.px - a.px) * dx + (p.py - a.py) * dy) / (len * len);
  t = Math.max(0, Math.min(1, t));
  const qx = a.px + t * dx;
  const qy = a.py + t * dy;
  return Math.hypot(p.px - qx, p.py - qy);
}

export function minDistanceNormPointToOpenPolylinePx(
  nx: number,
  ny: number,
  vertices: readonly { x: number; y: number }[],
  rect: PlayfieldRect
): number {
  if (vertices.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    const d = distNormPointToSegmentPx(nx, ny, a.x, a.y, b.x, b.y, rect);
    if (d < best) best = d;
  }
  return best;
}

/**
 * 열린 폴리라인(정규화 꼭짓점 순서) 위에서 `targetNorm`에 가장 가까운 점까지의 **누적 호장(px)**.
 * 재생: 스팟 인덱스 없이도 기하 충돌점과 `dCue`/`dObj` 맞춤 거리를 맞출 때 사용.
 */
export function distanceAlongOpenPolylineToClosestNormPointPx(
  vertices: readonly { x: number; y: number }[],
  targetNorm: { x: number; y: number },
  rect: PlayfieldRect
): number {
  if (vertices.length < 2) return 0;
  const T = normToPx(targetNorm.x, targetNorm.y, rect);
  let bestPointDist = Infinity;
  let bestAlong = 0;
  let cumulative = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = normToPx(vertices[i]!.x, vertices[i]!.y, rect);
    const b = normToPx(vertices[i + 1]!.x, vertices[i + 1]!.y, rect);
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    let u = ((T.px - a.px) * dx + (T.py - a.py) * dy) / (segLen * segLen);
    u = Math.max(0, Math.min(1, u));
    const qx = a.px + u * dx;
    const qy = a.py + u * dy;
    const d = Math.hypot(T.px - qx, T.py - qy);
    if (d < bestPointDist) {
      bestPointDist = d;
      bestAlong = cumulative + u * segLen;
    }
    cumulative += segLen;
  }
  return bestAlong;
}

/** 재생: 이동 공 **중심**이 스팟 **중심**과 맞닿았다고 볼 픽셀 허용치(`path-spot-display`의 공 중심 근접과 동일 계열) */
export const PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX = 1.5;

/**
 * 재생 폴리라인을 **시작에서부터** 따라갈 때, 꼭짓점을 잇는 각 세그먼트 위에 목표 정규화점과의 거리가
 * `epsPx` 이하인 **첫** 위치까지의 누적 호장(px). (공-공 2R 접촉 시점이 아니라 **스팟 중심 도달**용)
 */
export function distanceAlongOpenPolylineToFirstReachNormPointPx(
  vertices: readonly { x: number; y: number }[],
  targetNorm: { x: number; y: number },
  rect: PlayfieldRect,
  epsPx: number = PLAYBACK_SPOT_CENTER_ALIGN_EPS_PX
): number | null {
  const T = normToPx(targetNorm.x, targetNorm.y, rect);
  let cumulative = 0;
  for (let i = 0; i < vertices.length - 1; i++) {
    const a = normToPx(vertices[i]!.x, vertices[i]!.y, rect);
    const b = normToPx(vertices[i + 1]!.x, vertices[i + 1]!.y, rect);
    const dx = b.px - a.px;
    const dy = b.py - a.py;
    const segLen = Math.hypot(dx, dy);
    if (segLen < 1e-6) continue;
    const wx = T.px - a.px;
    const wy = T.py - a.py;
    let t = (wx * dx + wy * dy) / (segLen * segLen);
    t = Math.max(0, Math.min(1, t));
    const qx = a.px + t * dx;
    const qy = a.py + t * dy;
    const dist = Math.hypot(T.px - qx, T.py - qy);
    if (dist <= epsPx) {
      return cumulative + t * segLen;
    }
    cumulative += segLen;
  }
  return null;
}

/**
 * 수구→첫 스팟 광선상 1목 충돌점이, 실제로 그린 수구 경로(수구—스팟 폴리라인)와 맞닿는지.
 * 쿠션 등으로 광선과 다른 궤적이면 false.
 */
export function cuePolylineReachesFirstObjectCollision(
  cueNorm: { x: number; y: number },
  pathPoints: readonly { x: number; y: number }[],
  collisionNorm: { x: number; y: number },
  rect: PlayfieldRect,
  touchPx: number = SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX
): boolean {
  if (pathPoints.length < 1) return false;
  const chain: { x: number; y: number }[] = [cueNorm, ...pathPoints];
  return minDistanceNormPointToOpenPolylinePx(collisionNorm.x, collisionNorm.y, chain, rect) <= touchPx;
}

/** 1목 경로·표식용 — 광선 1목 + 폴리라인 닿음이 동시에 만족할 때만 충돌 반환 */
export function resolveEffectiveFirstObjectCollisionFromCuePath(
  placement: NanguBallPlacement,
  cueNorm: { x: number; y: number },
  pathPoints: readonly { x: number; y: number }[],
  rect: PlayfieldRect,
  touchPx: number = SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  if (pathPoints.length < 1) return null;
  const hit = cueFirstObjectHitFromBallPlacement(cueNorm, pathPoints[0], placement, rect);
  if (!hit) return null;
  if (!cuePolylineReachesFirstObjectCollision(cueNorm, pathPoints, hit.collision, rect, touchPx)) {
    return null;
  }
  return hit;
}

/** 2목 경로·표식용 — 1목 경로 스팟 폴리라인이 2목(남은 공) 접촉에 닿을 때만 충돌 반환(스팟 1개 이상 필요) */
export function resolveEffectiveSecondObjectCollisionFromObjectPath(
  placement: NanguBallPlacement,
  objectPathStartNorm: { x: number; y: number },
  objectPathPoints: readonly { x: number; y: number }[],
  firstObjectKey: LabeledBallNorm["key"],
  rect: PlayfieldRect,
  touchPx: number = SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  const secondKey = getSecondObjectBallKeyExclusive(placement, firstObjectKey);
  if (secondKey == null) return null;
  const remainingBall = ballLabeledNormForKey(placement, secondKey);
  if (objectPathPoints.length < 1) return null;

  let hit: { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null = null;

  let start = objectPathStartNorm;
  for (const pt of objectPathPoints) {
    hit = cueFirstObjectHitAmongNormalized(start, pt, [remainingBall], rect);
    if (hit) break;
    start = pt;
  }

  if (!hit) return null;

  if (
    !cuePolylineReachesFirstObjectCollision(
      objectPathStartNorm,
      objectPathPoints,
      hit.collision,
      rect,
      touchPx
    )
  ) {
    return null;
  }
  return hit;
}

/** 2목 경로·표식용 — 수구 경로 스팟 폴리라인이 2목(남은 공) 접촉에 닿을 때만 충돌 반환 */
export function resolveEffectiveSecondObjectCollisionFromCuePath(
  placement: NanguBallPlacement,
  cueNorm: { x: number; y: number },
  pathPoints: readonly { x: number; y: number }[],
  firstObjectKey: LabeledBallNorm["key"],
  rect: PlayfieldRect,
  touchPx: number = SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  const secondKey = getSecondObjectBallKeyExclusive(placement, firstObjectKey);
  if (secondKey == null) return null;
  const remainingBall = ballLabeledNormForKey(placement, secondKey);
  if (pathPoints.length < 1) return null;

  const targets: LabeledBallNorm[] = [{ key: remainingBall.key, x: remainingBall.x, y: remainingBall.y }];

  let hit: { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null = null;
  let start = cueNorm;
  for (const pt of pathPoints) {
    hit = cueFirstObjectHitAmongNormalized(start, pt, targets, rect);
    if (hit) break;
    start = pt;
  }
  if (!hit) return null;
  if (!cuePolylineReachesFirstObjectCollision(cueNorm, pathPoints, hit.collision, rect, touchPx)) {
    return null;
  }
  return hit;
}

/**
 * 수구 경로 또는 1목 경로 중 **어느 쪽 스팟 폴리라인이든** 2목 공 접촉에 닿으면 충돌 반환(1목 경로 우선).
 */
export function resolveEffectiveSecondObjectCollisionFromPaths(
  placement: NanguBallPlacement,
  cueNorm: { x: number; y: number },
  cuePathPoints: readonly { x: number; y: number }[],
  objectPathStartNorm: { x: number; y: number } | null,
  objectPathPoints: readonly { x: number; y: number }[],
  firstObjectKey: LabeledBallNorm["key"],
  rect: PlayfieldRect,
  touchPx: number = SOLUTION_PATH_FIRST_OBJECT_POLYLINE_CONTACT_PX
): { collision: { x: number; y: number }; objectKey: LabeledBallNorm["key"] } | null {
  const fromObject =
    objectPathStartNorm != null
      ? resolveEffectiveSecondObjectCollisionFromObjectPath(
          placement,
          objectPathStartNorm,
          objectPathPoints,
          firstObjectKey,
          rect,
          touchPx
        )
      : null;
  const fromCue = resolveEffectiveSecondObjectCollisionFromCuePath(
    placement,
    cueNorm,
    cuePathPoints,
    firstObjectKey,
    rect,
    touchPx
  );
  return fromObject ?? fromCue;
}

/**
 * 목적구(또는 1목 후보) **중심**과 **접근 방향 기준점**(수구·충돌점·직전 스팟)이 있을 때,
 * 그 방향으로 가장 가까운 **공 원주 위** 정규화 좌표 (경로가 공 내부를 관통하지 않게 할 때 사용).
 */
export function ballCircumferenceNormFacingApproach(
  ballCenterNorm: { x: number; y: number },
  approachNorm: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } {
  const O = normToPx(ballCenterNorm.x, ballCenterNorm.y, rect);
  const A = normToPx(approachNorm.x, approachNorm.y, rect);
  let vx = A.px - O.px;
  let vy = A.py - O.py;
  let len = Math.hypot(vx, vy);
  if (len < 1e-4) {
    vx = 1;
    vy = 0;
    len = 1;
  }
  vx /= len;
  vy /= len;
  const longSide = getPlayfieldLongSide(rect);
  const r = getBallRadius(longSide);
  const px = O.px + vx * r;
  const py = O.py + vy * r;
  return {
    x: (px - rect.left) / rect.width,
    y: (py - rect.top) / rect.height,
  };
}

/**
 * 선분 AB가 원 O(r)의 **열린** 원판(거리 < r)과 만나는지 — 경로가 목적구를 관통하는지 판별.
 */
function segmentIntersectsOpenDiskPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ox: number,
  oy: number,
  r: number
): boolean {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-14) {
    return Math.hypot(ax - ox, ay - oy) < r - 1e-3;
  }
  let t = ((ox - ax) * abx + (oy - ay) * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * abx;
  const py = ay + t * aby;
  const d = Math.hypot(px - ox, py - oy);
  return d < r - 0.35;
}

/** 선분이 수구가 아닌 **어느** 목적구 원(반지름 R)의 열린 원판이라도 관통하는지 */
function segmentPenetratesAnyObjectBallPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  allCentersNorm: readonly { x: number; y: number }[],
  r: number,
  rect: PlayfieldRect
): boolean {
  if (allCentersNorm.length === 0) return false;
  for (const cn of allCentersNorm) {
    const { px: ox, py: oy } = normalizedToPixel(cn.x, cn.y, rect);
    if (segmentIntersectsOpenDiskPx(ax, ay, bx, by, ox, oy, r)) return true;
  }
  return false;
}

/**
 * 스팟 원·목적구 원이 같은 반지름 R일 때 외접(중심거리 2R).
 * 탭 방향(목적구 중심→탭)으로 스팟 중심을 두되, 출발점→스팟 선분이 **모든** 목적구(비수구) 원 내부를 관통하지 않게 각도 보정.
 * @param segmentFromNorm 선분 시작(수구 또는 직전 스팟)
 * @param allObjectBallCentersNorm 수구 제외한 모든 목적구 중심 — 1목·2목 구분 없이 관통 검사
 */
export function spotCenterOnObjectBallExternalTangencyFromTap(
  segmentFromNorm: { x: number; y: number },
  tapNorm: { x: number; y: number },
  ballCenterNorm: { x: number; y: number },
  rect: PlayfieldRect,
  allObjectBallCentersNorm: readonly { x: number; y: number }[]
): { x: number; y: number } {
  const longSide = getPlayfieldLongSide(rect);
  const R = getBallRadius(longSide);
  const distPx = 2 * R;

  const penetrationTargets =
    allObjectBallCentersNorm.length > 0 ? allObjectBallCentersNorm : [ballCenterNorm];

  const O = normalizedToPixel(ballCenterNorm.x, ballCenterNorm.y, rect);
  const Tap = normalizedToPixel(tapNorm.x, tapNorm.y, rect);
  const C = normalizedToPixel(segmentFromNorm.x, segmentFromNorm.y, rect);

  let dx = Tap.px - O.px;
  let dy = Tap.py - O.py;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 1;
    dy = 0;
    len = 1;
  }
  const baseAng = Math.atan2(dy, dx);

  const tryAngle = (ang: number) => {
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const sx = O.px + ux * distPx;
    const sy = O.py + uy * distPx;
    return { sx, sy };
  };

  const step = (2 * Math.PI) / 360;
  const deltas: number[] = [0];
  for (let j = 1; j <= 180; j++) {
    deltas.push(j * step);
    deltas.push(-j * step);
  }

  for (const d of deltas) {
    const { sx, sy } = tryAngle(baseAng + d);
    if (!segmentPenetratesAnyObjectBallPx(C.px, C.py, sx, sy, penetrationTargets, R, rect)) {
      return pixelToNormalized(sx, sy, rect);
    }
  }

  /** 탭 방향으로 유효한 각도가 없을 때: 접근 방향 원주점 쪽으로 2R 외접 중심 */
  const surf = ballCircumferenceNormFacingApproach(ballCenterNorm, segmentFromNorm, rect);
  const surfPx = normalizedToPixel(surf.x, surf.y, rect);
  let sdx = surfPx.px - O.px;
  let sdy = surfPx.py - O.py;
  let slen = Math.hypot(sdx, sdy);
  if (slen < 1e-6) {
    sdx = 1;
    sdy = 0;
    slen = 1;
  }
  const fx = O.px + (sdx / slen) * distPx;
  const fy = O.py + (sdy / slen) * distPx;
  if (!segmentPenetratesAnyObjectBallPx(C.px, C.py, fx, fy, penetrationTargets, R, rect)) {
    return pixelToNormalized(fx, fy, rect);
  }

  for (let i = 0; i < 360; i++) {
    const ang = (i * 2 * Math.PI) / 360;
    const { sx, sy } = tryAngle(ang);
    if (!segmentPenetratesAnyObjectBallPx(C.px, C.py, sx, sy, penetrationTargets, R, rect)) {
      return pixelToNormalized(sx, sy, rect);
    }
  }

  return pixelToNormalized(fx, fy, rect);
}

/**
 * 단일 1목 중심만 알 때(레거시). 새 코드는 `cueFirstObjectHitFromBallPlacement` 권장.
 */
export function cueObjectCollisionNormalized(
  cueNorm: { x: number; y: number },
  firstSpotNorm: { x: number; y: number },
  objectNorm: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } | null {
  return (
    cueFirstObjectHitAmongNormalized(cueNorm, firstSpotNorm, [{ key: "red", x: objectNorm.x, y: objectNorm.y }], rect)
      ?.collision ?? null
  );
}
