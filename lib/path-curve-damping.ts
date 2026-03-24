/**
 * 재생 전용 — 곡선 세그먼트에서 유효 거리 소모(1/coeff)로 감속 체감.
 * 판정·폴리라인 생성은 변경하지 않음.
 */
import type { PlayfieldRect } from "@/lib/billiard-table-constants";
import { normalizedToPixel } from "@/lib/billiard-table-constants";
import { cueSegmentCurveKey, objectSegmentCurveKey } from "@/lib/path-curve-display";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { findCuePlaybackControlNorm, findObjectPlaybackControlNorm } from "@/lib/path-bezier-playback";
import type { NanguCurveNode, NanguPathPoint } from "@/lib/nangu-types";
import { polylineTotalLengthPx } from "@/lib/path-motion-geometry";
import type { NormPoint } from "@/lib/path-motion-geometry";

/** 제어점 직선 이탈거리(px) / 선분 길이(px) — 정규화 좌표를 픽셀로 변환 후 비율 */
export function curveMetricControlDeviationOverChord(
  p0: NormPoint,
  p1: NormPoint,
  p2: NormPoint,
  rect: PlayfieldRect
): number {
  const a = normalizedToPixel(p0.x, p0.y, rect);
  const b = normalizedToPixel(p2.x, p2.y, rect);
  const c = normalizedToPixel(p1.x, p1.y, rect);
  const dx = b.px - a.px;
  const dy = b.py - a.py;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return 0;
  const cross = (c.px - a.px) * dy - (c.py - a.py) * dx;
  const dPerp = Math.abs(cross) / chord;
  return dPerp / chord;
}

export function curveDampingCoefficientFromMetric(k: number): number {
  if (k < 0.05) return 0.9;
  if (k < 0.15) return 0.8;
  if (k < 0.3) return 0.7;
  return 0.6;
}

export type LogicalSegmentDampingPlan = {
  logicalSegmentPhysicalLengthsPx: number[];
  logicalSegmentCurveCoefficients: number[];
  effectivePathCostPx: number;
  curveSegmentCount: number;
  /** length-weighted mean of coefficients (straight=1 포함) */
  meanCurveCoefficient: number;
};

function buildSegmentDampingPlan(
  poly: NormPoint[],
  polyStraight: NormPoint[],
  spotEndVertexIndices: number[],
  numSegments: number,
  rect: PlayfieldRect,
  getKey: (segmentIndex: number) => string | null,
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes: NanguCurveNode[] | undefined,
  findControl: (
    key: string | null,
    controls: PathSegmentCurveControl[] | undefined,
    nodes: NanguCurveNode[] | undefined
  ) => NormPoint | null
): LogicalSegmentDampingPlan | null {
  if (
    numSegments < 1 ||
    spotEndVertexIndices.length !== numSegments ||
    polyStraight.length !== numSegments + 1
  ) {
    return null;
  }

  const logicalSegmentPhysicalLengthsPx: number[] = [];
  const logicalSegmentCurveCoefficients: number[] = [];

  for (let i = 0; i < numSegments; i++) {
    const vStart = i === 0 ? 0 : spotEndVertexIndices[i - 1]!;
    const vEnd = spotEndVertexIndices[i]!;
    if (vStart > vEnd || vEnd >= poly.length) return null;
    const sub = poly.slice(vStart, vEnd + 1);
    const L = polylineTotalLengthPx(sub, rect);
    logicalSegmentPhysicalLengthsPx.push(L);

    const key = getKey(i);
    const ctl = findControl(key, curveControls, curveNodes);
    let coeff = 1;
    if (ctl) {
      const k = curveMetricControlDeviationOverChord(polyStraight[i]!, ctl, polyStraight[i + 1]!, rect);
      coeff = curveDampingCoefficientFromMetric(k);
    }
    logicalSegmentCurveCoefficients.push(coeff);
  }

  let effectivePathCostPx = 0;
  let weightedCoeffSum = 0;
  let curveSegmentCount = 0;
  for (let i = 0; i < numSegments; i++) {
    const L = logicalSegmentPhysicalLengthsPx[i]!;
    const c = logicalSegmentCurveCoefficients[i]!;
    effectivePathCostPx += L / c;
    weightedCoeffSum += L * c;
    if (c < 1 - 1e-9) curveSegmentCount += 1;
  }
  const totalPhys = logicalSegmentPhysicalLengthsPx.reduce((s, x) => s + x, 0);
  const meanCurveCoefficient = totalPhys > 1e-9 ? weightedCoeffSum / totalPhys : 1;

  return {
    logicalSegmentPhysicalLengthsPx,
    logicalSegmentCurveCoefficients,
    effectivePathCostPx,
    curveSegmentCount,
    meanCurveCoefficient,
  };
}

export function computeCuePlaybackSegmentDampingPlan(
  poly: NormPoint[],
  polyStraight: NormPoint[],
  pathPoints: NanguPathPoint[],
  spotEndVertexIndices: number[] | undefined,
  rect: PlayfieldRect,
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes: NanguCurveNode[] | undefined
): LogicalSegmentDampingPlan | null {
  if (!spotEndVertexIndices?.length || pathPoints.length < 1) return null;
  return buildSegmentDampingPlan(
    poly,
    polyStraight,
    spotEndVertexIndices,
    pathPoints.length,
    rect,
    (i) => cueSegmentCurveKey(pathPoints, i),
    curveControls,
    curveNodes,
    findCuePlaybackControlNorm
  );
}

export function computeObjectPlaybackSegmentDampingPlan(
  poly: NormPoint[],
  polyStraight: NormPoint[],
  objectPathPoints: NanguPathPoint[],
  spotEndVertexIndices: number[] | undefined,
  rect: PlayfieldRect,
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes: NanguCurveNode[] | undefined
): LogicalSegmentDampingPlan | null {
  if (!spotEndVertexIndices?.length || objectPathPoints.length < 1) return null;
  return buildSegmentDampingPlan(
    poly,
    polyStraight,
    spotEndVertexIndices,
    objectPathPoints.length,
    rect,
    (i) => objectSegmentCurveKey(objectPathPoints, i),
    curveControls,
    curveNodes,
    findObjectPlaybackControlNorm
  );
}
