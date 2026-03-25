import { ballSpeedToLegacySpeed, ballSpeedToLegacySpeedLevel, type BallSpeed } from "@/lib/ball-speed-constants";
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import { cueFirstObjectHitFromBallPlacement } from "@/lib/solution-path-geometry";
import { resolveTroubleFirstObjectBallKey } from "@/lib/trouble-first-object-ball";
import type {
  NanguBallPlacement,
  NanguPathPoint,
  NanguSolutionData,
} from "@/lib/nangu-types";

function ballCenterNormForKey(
  placement: NanguBallPlacement,
  key: "red" | "yellow" | "white"
) {
  if (key === "red") return { x: placement.redBall.x, y: placement.redBall.y };
  if (key === "yellow") return { x: placement.yellowBall.x, y: placement.yellowBall.y };
  return { x: placement.whiteBall.x, y: placement.whiteBall.y };
}

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
  const resolvedStruckKey = resolveTroubleFirstObjectBallKey({
    placement: ballPlacement,
    cuePos,
    pathPoints,
    objectPathPoints,
    rect,
  });
  const struckKey = resolvedStruckKey ?? firstHit?.objectKey ?? null;

  let reflectionPath: NanguSolutionData["reflectionPath"];
  if (struckKey && objectPathPoints.length >= 1) {
    const objPts = objectPathPoints.map((p) => ({ x: p.x, y: p.y }));
    const startNorm = ballCenterNormForKey(ballPlacement, struckKey);
    reflectionPath = {
      points: [{ x: startNorm.x, y: startNorm.y }, ...objPts],
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
    reflectionObjectBall: reflectionPath && struckKey ? struckKey : undefined,
    ballSpeed,
    speedLevel: ballSpeedToLegacySpeedLevel(ballSpeed),
    speed: ballSpeedToLegacySpeed(ballSpeed),
  };
}
