/**
 * 경로 선분과 비수구 공(수구 제외) 사이 이격이 스팟(공 반지름)보다 작은지 검사.
 * 진행로가 공에 너무 붙었을 때 안내 오버레이용.
 */
import {
  normalizedToPixel,
  getBallRadius,
  getPlayfieldLongSide,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { getNonCueBallNorms, type NanguBallPlacement, type NanguPathPoint } from "@/lib/nangu-types";

function distPointToSegmentPx(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy || 1e-12;
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

function distNormSegmentToBallCenterPx(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  ballX: number,
  ballY: number,
  rect: PlayfieldRect
): number {
  const A = normalizedToPixel(ax, ay, rect);
  const B = normalizedToPixel(bx, by, rect);
  const P = normalizedToPixel(ballX, ballY, rect);
  return distPointToSegmentPx(P.px, P.py, A.px, A.py, B.px, B.py);
}

export function isPathTooCloseToNonCueBalls(params: {
  rect: PlayfieldRect;
  placement: NanguBallPlacement;
  cuePos: { x: number; y: number };
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  collisionNorm: { x: number; y: number } | null;
  checkCuePath: boolean;
  checkObjectPath: boolean;
}): boolean {
  const {
    rect,
    placement,
    cuePos,
    pathPoints,
    objectPathPoints,
    collisionNorm,
    checkCuePath,
    checkObjectPath,
  } = params;
  const spotR = getBallRadius(getPlayfieldLongSide(rect));
  const balls = getNonCueBallNorms(placement);
  if (balls.length === 0) return false;

  const segmentHitsBall = (ax: number, ay: number, bx: number, by: number) => {
    for (const b of balls) {
      const d = distNormSegmentToBallCenterPx(ax, ay, bx, by, b.x, b.y, rect);
      if (d < spotR) return true;
    }
    return false;
  };

  if (checkCuePath && pathPoints.length >= 1) {
    let prev = cuePos;
    for (const p of pathPoints) {
      if (segmentHitsBall(prev.x, prev.y, p.x, p.y)) return true;
      prev = { x: p.x, y: p.y };
    }
  }

  if (checkObjectPath && collisionNorm && objectPathPoints.length >= 1) {
    let prev = collisionNorm;
    for (const p of objectPathPoints) {
      if (segmentHitsBall(prev.x, prev.y, p.x, p.y)) return true;
      prev = { x: p.x, y: p.y };
    }
  }

  return false;
}
