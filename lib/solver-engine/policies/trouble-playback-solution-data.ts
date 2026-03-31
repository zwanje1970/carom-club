import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel, type BallSpeed } from "@/lib/ball-speed-constants";
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  cueFirstObjectHitFromBallPlacement,
  resolveEffectiveFirstObjectCollisionFromCuePath,
  resolveEffectiveSecondObjectCollisionFromPaths,
} from "@/lib/solution-path-geometry";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import type {
  NanguBallPlacement,
  NanguPathPoint,
  NanguSolutionData,
} from "@/lib/nangu-types";

function isSameNormPoint(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

export function buildTroublePlaybackSolutionData(params: {
  ballPlacement: NanguBallPlacement;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  secondObjectPathPoints?: NanguPathPoint[];
  ballSpeed: BallSpeed;
  isBankShot: boolean;
  thicknessOffsetX: number;
  rect: PlayfieldRect;
}): (NanguSolutionData & {
  secondReflectionPath?: NanguSolutionData["reflectionPath"];
  secondReflectionObjectBall?: "red" | "yellow" | "white";
}) | null {
  const { ballPlacement, pathPoints, objectPathPoints, secondObjectPathPoints, ballSpeed, isBankShot, thicknessOffsetX, rect } =
    params;
  if (pathPoints.length < 1) return null;

  const cuePos =
    ballPlacement.cueBall === "yellow" ? ballPlacement.yellowBall : ballPlacement.whiteBall;
  const pointsForPath = pathPoints.map((p) => ({ x: p.x, y: p.y }));
  const firstHit = cueFirstObjectHitFromBallPlacement(cuePos, pathPoints[0], ballPlacement, rect);
  const effectiveContact = resolveEffectiveFirstObjectCollisionFromCuePath(
    ballPlacement,
    cuePos,
    pathPoints,
    rect
  );
  const resolvedStruckKey = resolveTroubleFirstObjectBallKey({
    placement: ballPlacement,
    cuePos,
    pathPoints,
    objectPathPoints,
    rect,
  });
  const struckKey = resolvedStruckKey ?? firstHit?.objectKey ?? null;

  let reflectionPath: NanguSolutionData["reflectionPath"];
  let secondReflectionPath: NanguSolutionData["reflectionPath"];
  let secondContactForPlayback: ReturnType<typeof resolveEffectiveSecondObjectCollisionFromPaths> = null;
  /** 1목 경로: 수구 폴리라인이 광선 충돌에 닿을 때만, 첫 점은 접촉점(원주) — 공 중심 아님 */
  if (effectiveContact && objectPathPoints.length >= 1) {
    const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
    const c = effectiveContact.collision;
    const startsAtCollision = objectPathPoints.length > 0 && isSameNormPoint(objectPathPoints[0]!, c);
    reflectionPath = {
      points: startsAtCollision ? objPts : [{ x: c.x, y: c.y }, ...objPts],
      pointsWithType: objectPathPoints,
    };

    if (secondObjectPathPoints && secondObjectPathPoints.length >= 1) {
      secondContactForPlayback = resolveEffectiveSecondObjectCollisionFromPaths(
        ballPlacement,
        cuePos,
        pointsForPath,
        c,
        objPts,
        effectiveContact.objectKey,
        rect
      );
      if (secondContactForPlayback) {
        const obj2Pts = secondObjectPathPoints.map((p) => ({ x: p.x, y: p.y }));
        const c2 = secondContactForPlayback.collision;
        const startsAtCollision2 = secondObjectPathPoints.length > 0 && isSameNormPoint(secondObjectPathPoints[0]!, c2);
        secondReflectionPath = {
          points: startsAtCollision2 ? obj2Pts : [{ x: c2.x, y: c2.y }, ...obj2Pts],
          pointsWithType: secondObjectPathPoints,
        };
      }
    }
  }

  return {
    isBankShot,
    thicknessOffsetX: isBankShot ? undefined : thicknessOffsetX,
    tipX: 0,
    tipY: 0,
    spinX: 0,
    spinY: 0,
    paths: [{ points: pointsForPath, pointsWithType: pathPoints }],
    reflectionPath,
    reflectionObjectBall: reflectionPath && effectiveContact ? effectiveContact.objectKey : undefined,
    secondReflectionPath,
    secondReflectionObjectBall: secondReflectionPath ? secondContactForPlayback?.objectKey : undefined,
    ballSpeed,
    speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
    speed: ballSpeedToLegacySpeed(ballSpeed),
  };
}
