/**
 * 경로 선분과 비수구 공(수구 제외) 사이 이격이 스팟(공 반지름)보다 작은지 검사.
 * 진행로가 공에 너무 붙었을 때 안내 오버레이용.
 *
 * 규칙:
 * - 스팟이 해당 목적구에 붙은 경우(`type==="ball"` + 탭 반경 내): 그 선분은 해당 공에 대해 검사하지 않음.
 * - 1목 경로 첫 선분은 충돌점에서 출발 → 충돌 난 공(`collisionStruckBallKey`)에 대해 첫 선분은 검사 제외.
 * - 위에 해당하지 않는 선분만, 공 중심 ↔ 선분 최단거리(px)가 스팟 반지름(=공 반지름) 미만이면 true.
 */
import {
  normalizedToPixel,
  getBallRadius,
  getPlayfieldLongSide,
  distanceNormPointsInPlayfieldPx,
  getSolutionPathBallTapRadiusPx,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguPathPoint,
  type ObjectBallColorKey,
  type LabeledBallNorm,
} from "@/lib/nangu-types";

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

/** 스팟이 이 비수구 공에 탭으로 붙은 것으로 볼 수 있는지 */
function pathPointAttachedToBall(p: NanguPathPoint, ball: LabeledBallNorm, rect: PlayfieldRect): boolean {
  if (p.type !== "ball") return false;
  const tapR = getSolutionPathBallTapRadiusPx(rect);
  return distanceNormPointsInPlayfieldPx({ x: p.x, y: p.y }, { x: ball.x, y: ball.y }, rect) <= tapR;
}

/** 해당 공에 대해 이 선분은 의도적 접촉/출발이라 간격 검사 생략 */
function segmentExemptForBall(
  ball: LabeledBallNorm,
  endPoint: NanguPathPoint,
  startPoint: NanguPathPoint | null,
  startIsCollisionPoint: boolean,
  collisionStruckBallKey: ObjectBallColorKey | null,
  rect: PlayfieldRect
): boolean {
  if (pathPointAttachedToBall(endPoint, ball, rect)) return true;
  if (startPoint && pathPointAttachedToBall(startPoint, ball, rect)) return true;
  if (startIsCollisionPoint && collisionStruckBallKey === ball.key) return true;
  return false;
}

export function isPathTooCloseToNonCueBalls(params: {
  rect: PlayfieldRect;
  placement: NanguBallPlacement;
  cuePos: { x: number; y: number };
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  secondObjectPathPoints?: NanguPathPoint[];
  collisionNorm: { x: number; y: number } | null;
  /** 수구→첫 스팟 광선이 맞은 비수구 공 — 1목 경로 첫 선분은 이 공 표면에서 출발 */
  collisionStruckBallKey?: ObjectBallColorKey | null;
  checkCuePath: boolean;
  checkObjectPath: boolean;
  checkSecondObjectPath?: boolean;
}): boolean {
  const {
    rect,
    placement,
    cuePos,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints = [],
    collisionNorm,
    collisionStruckBallKey = null,
    checkCuePath,
    checkObjectPath,
    checkSecondObjectPath = false,
  } = params;
  const spotR = getBallRadius(getPlayfieldLongSide(rect));
  const balls = getNonCueBallNorms(placement);
  if (balls.length === 0) return false;

  const segmentTooClose = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    ball: LabeledBallNorm
  ) => {
    const d = distNormSegmentToBallCenterPx(ax, ay, bx, by, ball.x, ball.y, rect);
    return d < spotR;
  };

  if (checkCuePath && pathPoints.length >= 1) {
    let prev = cuePos;
    let prevPoint: NanguPathPoint | null = null;
    for (let i = 0; i < pathPoints.length; i++) {
      const p = pathPoints[i]!;
      for (const b of balls) {
        if (segmentExemptForBall(b, p, prevPoint, false, null, rect)) continue;
        if (segmentTooClose(prev.x, prev.y, p.x, p.y, b)) return true;
      }
      prev = { x: p.x, y: p.y };
      prevPoint = p;
    }
  }

  if (checkObjectPath && collisionNorm && objectPathPoints.length >= 1) {
    let prev = collisionNorm;
    let prevPoint: NanguPathPoint | null = null;
    for (let i = 0; i < objectPathPoints.length; i++) {
      const p = objectPathPoints[i]!;
      const startIsCollision = i === 0;
      for (const b of balls) {
        if (segmentExemptForBall(b, p, prevPoint, startIsCollision, collisionStruckBallKey, rect)) continue;
        if (segmentTooClose(prev.x, prev.y, p.x, p.y, b)) return true;
      }
      prev = { x: p.x, y: p.y };
      prevPoint = p;
    }
  }

  if (checkSecondObjectPath && secondObjectPathPoints.length >= 1) {
    let prevPoint: NanguPathPoint | null = null;
    for (let i = 0; i < secondObjectPathPoints.length; i++) {
      const p = secondObjectPathPoints[i]!;
      if (i > 0 && prevPoint) {
        for (const b of balls) {
          if (segmentExemptForBall(b, p, prevPoint, false, null, rect)) continue;
          if (segmentTooClose(prevPoint.x, prevPoint.y, p.x, p.y, b)) return true;
        }
      }
      prevPoint = p;
    }
  }

  return false;
}
