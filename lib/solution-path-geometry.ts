/**
 * 수구→첫 스팟 직선과 1목적구(원)의 접촉 시점 — 중심거리 = 2R 인 첫 교점
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import { getBallRadius, getPlayfieldLongSide, normalizedToPixel } from "@/lib/billiard-table-constants";

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
 * 수구에서 첫 스팟 방향으로 진행할 때 1목적구와의 이론적 접촉점(정규화 좌표).
 * 교점이 없으면 null.
 */
export function cueObjectCollisionNormalized(
  cueNorm: { x: number; y: number },
  firstSpotNorm: { x: number; y: number },
  objectNorm: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } | null {
  const C = normToPx(cueNorm.x, cueNorm.y, rect);
  const P = normToPx(firstSpotNorm.x, firstSpotNorm.y, rect);
  const O = normToPx(objectNorm.x, objectNorm.y, rect);
  let dx = P.px - C.px;
  let dy = P.py - C.py;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  dx /= len;
  dy /= len;
  const longSide = getPlayfieldLongSide(rect);
  const r = getBallRadius(longSide);
  const R = 2 * r;
  const t = rayCircleSmallestPositiveT(C.px, C.py, dx, dy, O.px, O.py, R);
  if (t == null) return null;
  const hitPx = C.px + t * dx;
  const hitPy = C.py + t * dy;
  return {
    x: (hitPx - rect.left) / rect.width,
    y: (hitPy - rect.top) / rect.height,
  };
}
