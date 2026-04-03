/**
 * 쿠션/프레임(플레이필드 바깥) 탭 시: 직전 점→탭 방향 반직선이 먼저 만나는
 * - 수구가 아닌 공 원 둘레(선택적)
 * - 플레이필드 경계(쿠션 라인)
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  getPlayfieldRect,
  getBallRadius,
  getPlayfieldLongSide,
  landscapeToPortraitNorm,
  normalizedToPixel,
  pixelToNormalized,
  portraitToLandscapeNorm,
} from "@/lib/billiard-table-constants";

/** landscape 저장 좌표 → 플레이필드 캔버스 픽셀 (반직선 aimCanvasPx용) */
export function landscapeNormToPlayfieldCanvasPx(
  normLandscape: { x: number; y: number },
  canvasW: number,
  canvasH: number,
  portrait: boolean
): { x: number; y: number } {
  const pfCanvas = getPlayfieldRect(canvasW, canvasH);
  const view = portrait ? landscapeToPortraitNorm(normLandscape.x, normLandscape.y) : normLandscape;
  const { px, py } = normalizedToPixel(view.x, view.y, pfCanvas);
  return { x: px, y: py };
}

/** 테이블 캔버스 탭을 플레이필드 안으로 클램프한 뒤 landscape 정규화 좌표 */
export function tableCanvasClampedToPlayfieldLandscapeNorm(
  cx: number,
  cy: number,
  canvasW: number,
  canvasH: number,
  portrait: boolean
): { x: number; y: number } {
  const pfCanvas = getPlayfieldRect(canvasW, canvasH);
  const px = Math.min(Math.max(cx, pfCanvas.left), pfCanvas.left + pfCanvas.width);
  const py = Math.min(Math.max(cy, pfCanvas.top), pfCanvas.top + pfCanvas.height);
  const vn = pixelToNormalized(px, py, pfCanvas);
  return portrait ? portraitToLandscapeNorm(vn.x, vn.y) : vn;
}
import type { NanguBallPlacement, ObjectBallColorKey } from "@/lib/nangu-types";
import { getNonCueBallNorms } from "@/lib/nangu-types";

const RAY_EPS = 1e-4;
const BALL_START_SKIP_PX = 2;

function rayVerticalEdgeT(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  xConst: number,
  yMin: number,
  yMax: number
): number | null {
  if (Math.abs(dx) < RAY_EPS) return null;
  const t = (xConst - ox) / dx;
  if (t <= RAY_EPS) return null;
  const y = oy + t * dy;
  if (y < yMin - 1e-6 || y > yMax + 1e-6) return null;
  return t;
}

function rayHorizontalEdgeT(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  yConst: number,
  xMin: number,
  xMax: number
): number | null {
  if (Math.abs(dy) < RAY_EPS) return null;
  const t = (yConst - oy) / dy;
  if (t <= RAY_EPS) return null;
  const x = ox + t * dx;
  if (x < xMin - 1e-6 || x > xMax + 1e-6) return null;
  return t;
}

/** 반직선(단위 방향 아님, t는 픽셀 거리)이 플레이필드 AABB 테두리에 닿는 가장 작은 t>0 */
export function rayFirstHitPlayfieldBoundaryPx(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  pf: PlayfieldRect
): { t: number; px: number; py: number } | null {
  const L = pf.left;
  const T = pf.top;
  const R = pf.left + pf.width;
  const B = pf.top + pf.height;
  let bestT: number | null = null;
  const take = (t: number | null) => {
    if (t == null) return;
    if (bestT == null || t < bestT) bestT = t;
  };
  take(rayVerticalEdgeT(ox, oy, dx, dy, L, T, B));
  take(rayVerticalEdgeT(ox, oy, dx, dy, R, T, B));
  take(rayHorizontalEdgeT(ox, oy, dx, dy, T, L, R));
  take(rayHorizontalEdgeT(ox, oy, dx, dy, B, L, R));
  if (bestT == null) return null;
  return { t: bestT, px: ox + bestT * dx, py: oy + bestT * dy };
}

/** P(u)=O+u*D (D=aim−O) 와 원의 교차 중 u>minU 최소 */
function rayCircleSmallestPositiveU(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
  minU: number
): number | null {
  const fx = ox - cx;
  const fy = oy - cy;
  const a = dx * dx + dy * dy;
  if (a < RAY_EPS * RAY_EPS) return null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sd = Math.sqrt(Math.max(0, disc));
  const u1 = (-b - sd) / (2 * a);
  const u2 = (-b + sd) / (2 * a);
  let best: number | null = null;
  for (const u of [u1, u2]) {
    if (u > minU && (best == null || u < best)) best = u;
  }
  return best;
}

export type RayHitLandscape = { x: number; y: number; type: "cushion" | "ball" };

function canvasPfPxToLandscapeNorm(
  px: number,
  py: number,
  pfCanvas: PlayfieldRect,
  portrait: boolean
): { x: number; y: number } {
  const n = pixelToNormalized(px, py, pfCanvas);
  return portrait ? portraitToLandscapeNorm(n.x, n.y) : n;
}

/**
 * landscape 저장 좌표의 출발점에서, 캔버스 상 탭점 방향으로 뻗어 첫 번째로 맞는 지점.
 * @param allowNonCueBallCircle — false면 쿠션 라인만 (체인 중 등)
 * @param excludeBallKeys — 1목 경로 등: 출발이 맞은 공 표면일 때 같은 공 원이 다시 먼저 맞는 것을 막음
 */
export function resolveCuePathRayHitLandscape(params: {
  fromLandscape: { x: number; y: number };
  aimCanvasPx: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  portrait: boolean;
  collisionRectLandscape: PlayfieldRect;
  ballPlacement: NanguBallPlacement | null;
  allowNonCueBallCircle: boolean;
  excludeBallKeys?: readonly ObjectBallColorKey[];
}): RayHitLandscape | null {
  const {
    fromLandscape,
    aimCanvasPx,
    canvasW,
    canvasH,
    portrait,
    ballPlacement,
    allowNonCueBallCircle,
    excludeBallKeys,
  } = params;

  const pfCanvas = getPlayfieldRect(canvasW, canvasH);
  /** 공 반지름은 반직선 좌표와 동일한 `pfCanvas` 픽셀 스케일 기준 (landscape rect와 불일치 시 목적구 교차 누락 방지) */
  const longSidePx = getPlayfieldLongSide(pfCanvas);
  const ballR = getBallRadius(longSidePx);
  const fromView = portrait ? landscapeToPortraitNorm(fromLandscape.x, fromLandscape.y) : fromLandscape;
  const fromPx = normalizedToPixel(fromView.x, fromView.y, pfCanvas);
  const ox = fromPx.px;
  const oy = fromPx.py;
  const dx = aimCanvasPx.x - ox;
  const dy = aimCanvasPx.y - oy;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return null;

  /** P(u)=O+u*D, D=aim−O, u 무차원 */
  let bestU = Infinity;
  let best: RayHitLandscape | null = null;

  const minUAlongRay = BALL_START_SKIP_PX / len;

  if (allowNonCueBallCircle && ballPlacement) {
    const skip = excludeBallKeys?.length ? new Set(excludeBallKeys) : null;
    for (const b of getNonCueBallNorms(ballPlacement)) {
      if (skip?.has(b.key)) continue;
      const bv = portrait ? landscapeToPortraitNorm(b.x, b.y) : { x: b.x, y: b.y };
      const cp = normalizedToPixel(bv.x, bv.y, pfCanvas);
      const u = rayCircleSmallestPositiveU(ox, oy, dx, dy, cp.px, cp.py, ballR, minUAlongRay);
      if (u != null && u < bestU) {
        bestU = u;
        const px = ox + u * dx;
        const py = oy + u * dy;
        const land = canvasPfPxToLandscapeNorm(px, py, pfCanvas, portrait);
        best = { x: land.x, y: land.y, type: "ball" };
      }
    }
  }

  const boundary = rayFirstHitPlayfieldBoundaryPx(ox, oy, dx, dy, pfCanvas);
  if (boundary && boundary.t < bestU) {
    bestU = boundary.t;
    const land = canvasPfPxToLandscapeNorm(boundary.px, boundary.py, pfCanvas, portrait);
    best = {
      x: Math.min(1, Math.max(0, land.x)),
      y: Math.min(1, Math.max(0, land.y)),
      type: "cushion",
    };
  }

  return best;
}

/**
 * 1목 경로: 출발이 충돌점 또는 이전 스팟. 수구가 아닌 공 원 + 쿠션 경계 중 먼저 맞는 쪽.
 * `allowNonCueBallCircle`: false면 쿠션 라인만 (체인 중간 구간).
 */
export function resolveObjectPathRayHitLandscape(params: {
  fromLandscape: { x: number; y: number };
  aimCanvasPx: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  portrait: boolean;
  collisionRectLandscape: PlayfieldRect;
  ballPlacement: NanguBallPlacement | null;
  allowNonCueBallCircle?: boolean;
  excludeBallKeys?: readonly ObjectBallColorKey[];
}): RayHitLandscape | null {
  const {
    fromLandscape,
    aimCanvasPx,
    canvasW,
    canvasH,
    portrait,
    collisionRectLandscape,
    ballPlacement,
    allowNonCueBallCircle,
    excludeBallKeys,
  } = params;
  const allow =
    allowNonCueBallCircle !== undefined ? allowNonCueBallCircle : Boolean(ballPlacement);
  return resolveCuePathRayHitLandscape({
    fromLandscape,
    aimCanvasPx,
    canvasW,
    canvasH,
    portrait,
    collisionRectLandscape,
    ballPlacement,
    allowNonCueBallCircle: allow,
    excludeBallKeys,
  });
}
