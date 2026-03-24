/**
 * 난구해결 해법(solutionData JSON) → 노트 미리보기 오버레이용 경로 포인트.
 */
import type {
  NanguCurveNode,
  NanguPathPoint,
  NanguSolutionData,
  NanguSolutionPath,
} from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";

function pathPointsFromSolutionPath(p: NanguSolutionPath | undefined): NanguPathPoint[] {
  if (!p) return [];
  if (p.pointsWithType && p.pointsWithType.length > 0) return p.pointsWithType;
  if (p.points && p.points.length > 0) {
    return p.points.map(
      (pt) =>
        ({
          x: pt.x,
          y: pt.y,
          type: "free",
        }) as NanguPathPoint
    );
  }
  return [];
}

export function pathsFromTroubleSolutionDataJson(
  raw: Record<string, unknown> | null | undefined
): {
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  cuePathDisplayCurves: PathSegmentCurveControl[] | undefined;
  objectPathDisplayCurves: PathSegmentCurveControl[] | undefined;
  cuePathCurveNodes: NanguCurveNode[] | undefined;
  objectPathCurveNodes: NanguCurveNode[] | undefined;
} {
  if (!raw) {
    return {
      pathPoints: [],
      objectPathPoints: [],
      cuePathDisplayCurves: undefined,
      objectPathDisplayCurves: undefined,
      cuePathCurveNodes: undefined,
      objectPathCurveNodes: undefined,
    };
  }
  const s = raw as unknown as NanguSolutionData;
  const cuePath = s.paths?.[0];
  const pathPoints = pathPointsFromSolutionPath(cuePath);
  const ref = s.reflectionPath;
  const objectPathPoints = pathPointsFromSolutionPath(ref);
  return {
    pathPoints,
    objectPathPoints,
    cuePathDisplayCurves: s.cuePathDisplayCurves,
    objectPathDisplayCurves: s.objectPathDisplayCurves,
    cuePathCurveNodes: s.cuePathCurveNodes,
    objectPathCurveNodes: s.objectPathCurveNodes,
  };
}
