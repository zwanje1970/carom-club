import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel, type BallSpeed } from "@/lib/ball-speed-constants";
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import {
  cueFirstObjectHitFromBallPlacement,
  resolveEffectiveFirstObjectCollisionFromCuePath,
} from "@/lib/solution-path-geometry";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import type {
  NanguBallPlacement,
  NanguPathPoint,
  NanguSolutionData,
} from "@/lib/nangu-types";

export function buildTroublePlaybackSolutionData(params: {
  ballPlacement: NanguBallPlacement;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  ballSpeed: BallSpeed;
  isBankShot: boolean;
  thicknessOffsetX: number;
  rect: PlayfieldRect;
}): NanguSolutionData | null {
  const { ballPlacement, pathPoints, objectPathPoints, ballSpeed, isBankShot, thicknessOffsetX, rect } =
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
  /** 1목 경로: 수구 폴리라인이 광선 충돌에 닿을 때만, 첫 점은 접촉점(원주) — 공 중심 아님 */
  if (effectiveContact && objectPathPoints.length >= 1) {
    const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
    const c = effectiveContact.collision;
    reflectionPath = {
      points: [{ x: c.x, y: c.y }, ...objPts],
      pointsWithType: objectPathPoints,
    };
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
    ballSpeed,
    speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
    speed: ballSpeedToLegacySpeed(ballSpeed),
  };
}
