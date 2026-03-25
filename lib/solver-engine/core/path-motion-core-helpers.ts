import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import type {
  NanguBallPlacement,
  NanguPathPoint,
} from "@/lib/nangu-types";
import type { NormPoint } from "@/lib/path-motion-geometry";
import type { BuildPathMotionPlanOptions } from "@/lib/solution-path-motion";
import { spotCenterNormForDraw } from "@/lib/path-spot-display";

export function cuePositionFromPlacement(placement: NanguBallPlacement): NormPoint {
  return placement.cueBall === "yellow" ? placement.yellowBall : placement.whiteBall;
}

export function countCushionsInPath(path: { pointsWithType?: NanguPathPoint[] } | undefined): number {
  const typed = path?.pointsWithType;
  if (typed?.length) return typed.filter((p) => p.type === "cushion").length;
  return 0;
}

export function verticesFromCueAndSpots(cue: NormPoint, spotCoords: { x: number; y: number }[]): NormPoint[] {
  if (spotCoords.length === 0) return [cue];
  return [cue, ...spotCoords.map((p) => ({ x: p.x, y: p.y }))];
}

export function objectReflectionPolylineNormalized(
  firstVertex: NormPoint,
  pts: readonly { x: number; y: number }[],
  typed: NanguPathPoint[] | undefined,
  rect: PlayfieldRect,
  options?: BuildPathMotionPlanOptions
): NormPoint[] {
  const rawTail = pts.slice(1).map((p) => ({ x: p.x, y: p.y }));
  const canUseSpotDraw =
    Boolean(options?.visualizationPlayback) &&
    (options?.objectBallNormsForSpotDraw?.length ?? 0) > 0 &&
    Boolean(typed) &&
    typed!.length === pts.length - 1;

  if (!canUseSpotDraw) {
    return [{ x: firstVertex.x, y: firstVertex.y }, ...rawTail];
  }

  const spotOpts = { objectBallNorms: options!.objectBallNormsForSpotDraw! };
  const tail = typed!.map((p) => spotCenterNormForDraw(p, rect, spotOpts));
  return [{ x: firstVertex.x, y: firstVertex.y }, ...tail];
}
