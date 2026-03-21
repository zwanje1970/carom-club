/**
 * 수구→첫 스팟 직선과 1목적구(원)의 접촉 시점 — 중심거리 = 2R 인 첫 교점
 * 1목은 수구를 제외한 두 공 중, 광선상 가장 먼저 맞는 공.
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import { getBallRadius, getPlayfieldLongSide, normalizedToPixel } from "@/lib/billiard-table-constants";
import { getNonCueBallNorms, type LabeledBallNorm, type NanguBallPlacement } from "@/lib/nangu-types";

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
