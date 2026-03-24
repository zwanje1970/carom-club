import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  getPlayfieldRect,
  getPlayfieldLongSide,
} from "../lib/billiard-table-constants";
import { ballSpeedToRailCount, normalizeBallSpeed } from "../lib/ball-speed-constants";
import { computePolylinePlaybackDurationMs } from "../lib/path-animation-timing";
import { TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR } from "../lib/trouble-playback-distance";
import { troublePlaybackSpeedFactorFromRailCount } from "../lib/trouble-playback-rail-timing";
import type { NanguBallPlacement, NanguSolutionData, NanguPathPoint } from "../lib/nangu-types";
import {
  buildCuePathMotionPlan,
  buildObjectPathMotionPlan,
  computeCueProgress01ForFirstObjectHitAlongFullPath,
} from "../lib/solution-path-motion";

type CaseSpec = {
  name: string;
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
};

function makeCase(railCount: number, spec: CaseSpec) {
  const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);
  const placement: NanguBallPlacement = {
    cueBall: "white",
    whiteBall: { x: 0.18, y: 0.72 },
    yellowBall: { x: 0.84, y: 0.2 },
    redBall: { x: 0.40, y: 0.68 },
  };

  const pathPoints = spec.pathPoints;
  const objectPathPoints = spec.objectPathPoints;

  const ballSpeed = normalizeBallSpeed(railCount);
  const data: NanguSolutionData = {
    isBankShot: false,
    thicknessOffsetX: 0,
    paths: [{ points: pathPoints.map((p) => ({ x: p.x, y: p.y })), pointsWithType: pathPoints }],
    reflectionPath: {
      points: [{ x: placement.redBall.x, y: placement.redBall.y }, ...objectPathPoints.map((p) => ({ x: p.x, y: p.y }))],
      pointsWithType: objectPathPoints,
    },
    reflectionObjectBall: "red",
    ballSpeed,
    speedLevel: 6,
    speed: 3,
  };

  const cuePlan = buildCuePathMotionPlan(placement, data, rect, {
    visualizationPlayback: true,
    troublePlaybackModel: true,
    ignorePhysics: false,
  });
  const objectPlan = buildObjectPathMotionPlan(data, rect, {
    visualizationPlayback: true,
    troublePlaybackModel: true,
    ignorePhysics: false,
  });
  if (!cuePlan || !objectPlan) throw new Error("plan build failed");

  const hit = computeCueProgress01ForFirstObjectHitAlongFullPath(
    cuePlan,
    pathPoints,
    placement,
    rect,
    "red"
  );
  const V = cuePlan.playbackCueDistanceBeforeHitPx ?? 0;
  const longRailDistance = getPlayfieldLongSide(rect);
  const dHit = hit.pHit01 * cuePlan.pathLengthPx;
  const cuePreAppliedPx = Math.min(dHit, V);
  const cuePostAppliedPx = Math.max(0, cuePlan.effectiveTravelPx - cuePreAppliedPx);
  const objectPostAppliedPx = objectPlan.effectiveTravelPx;
  const railCountDerived = ballSpeedToRailCount(ballSpeed);
  const speedFactor = troublePlaybackSpeedFactorFromRailCount(railCountDerived);
  const durationMs = Math.max(
    1,
    Math.round(
      computePolylinePlaybackDurationMs(Math.max(1, cuePlan.effectiveTravelPx), rect) / speedFactor
    )
  );
  const averageSpeedPxPerMs = cuePlan.effectiveTravelPx / durationMs;

  return {
    case: spec.name,
    railCount,
    normalizeBallSpeed: ballSpeed,
    longRailDistance,
    formula: `longRailDistance * ${railCount} * ${TROUBLE_RAIL_DISTANCE_EXTRA_FACTOR}`,
    V,
    cuePreAppliedPx,
    cuePostAppliedPx,
    objectPostAppliedPx,
    effectiveTravelPx: cuePlan.effectiveTravelPx,
    durationMs,
    averageSpeedPxPerMs,
    ignorePhysics: false,
  };
}

const CASES: CaseSpec[] = [
  {
    name: "long-pre-hit",
    // cue -> first ball(=red)까지 구간을 길게 만들어 pre 구간 차이를 키움
    pathPoints: [
      { id: "p1", x: 0.92, y: 0.08, type: "ball" },
      { id: "p2", x: 0.97, y: 0.85, type: "cushion" },
      { id: "p3", x: 0.16, y: 0.92, type: "free" },
      { id: "p4", x: 0.04, y: 0.22, type: "cushion" },
      { id: "p5", x: 0.85, y: 0.16, type: "end" },
    ],
    objectPathPoints: [
      { id: "o1", x: 0.25, y: 0.16, type: "free" },
      { id: "o2", x: 0.08, y: 0.48, type: "cushion" },
      { id: "o3", x: 0.42, y: 0.86, type: "end" },
    ],
  },
  {
    name: "long-post-hit",
    // 첫 충돌은 빠르게 만들고, 충돌 후 cue/object 경로를 길게 설정
    pathPoints: [
      { id: "p1", x: 0.28, y: 0.70, type: "ball" },
      { id: "p2", x: 0.95, y: 0.72, type: "cushion" },
      { id: "p3", x: 0.12, y: 0.94, type: "free" },
      { id: "p4", x: 0.02, y: 0.24, type: "cushion" },
      { id: "p5", x: 0.98, y: 0.22, type: "cushion" },
      { id: "p6", x: 0.20, y: 0.86, type: "free" },
      { id: "p7", x: 0.86, y: 0.90, type: "end" },
    ],
    objectPathPoints: [
      { id: "o1", x: 0.96, y: 0.66, type: "cushion" },
      { id: "o2", x: 0.10, y: 0.90, type: "free" },
      { id: "o3", x: 0.03, y: 0.16, type: "cushion" },
      { id: "o4", x: 0.88, y: 0.10, type: "free" },
      { id: "o5", x: 0.97, y: 0.52, type: "cushion" },
      { id: "o6", x: 0.60, y: 0.92, type: "end" },
    ],
  },
];

const target = CASES.find((c) => c.name === "long-post-hit")!;
const rows = [1, 3, 5].map((r) => makeCase(r, target));
console.log(JSON.stringify(rows, null, 2));
