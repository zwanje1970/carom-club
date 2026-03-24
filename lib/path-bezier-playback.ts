/**
 * 재생 전용 — 직선 꼭짓점 폴리라인을 세그먼트별 2차 베지어로 치환(샘플링).
 * 판정·충돌·clearance는 pathPoints 직선 유지, 표시·playback만 사용.
 */
import type { NanguCurveNode, NanguPathPoint } from "@/lib/nangu-types";
import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import { cueSegmentCurveKey, objectSegmentCurveKey } from "@/lib/path-curve-display";
import type { NormPoint } from "@/lib/path-motion-geometry";
import { buildCurveSegmentPoints, DEFAULT_QUADRATIC_BEZIER_SEGMENTS } from "@/lib/nangu-curve-sampling";

function findCurveCtl(controls: PathSegmentCurveControl[] | undefined, key: string | null): PathSegmentCurveControl | undefined {
  if (!controls?.length || !key) return undefined;
  return controls.find((c) => c.key === key);
}

/** 수구 재생: `cuePathCurveNodes`가 있으면 레거시 display 제어점보다 우선 */
export function findCuePlaybackControlNorm(
  key: string | null,
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes: NanguCurveNode[] | undefined
): NormPoint | null {
  if (!key) return null;
  const node = curveNodes?.find((n) => n.segmentKey === key);
  if (node) return { x: node.x, y: node.y };
  const ctl = findCurveCtl(curveControls, key);
  return ctl ? { x: ctl.x, y: ctl.y } : null;
}

/** 1목 재생: `objectPathCurveNodes`가 있으면 레거시 display 제어점보다 우선 (수구와 동일 규칙) */
export function findObjectPlaybackControlNorm(
  key: string | null,
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes: NanguCurveNode[] | undefined
): NormPoint | null {
  if (!key) return null;
  const node = curveNodes?.find((n) => n.segmentKey === key);
  if (node) return { x: node.x, y: node.y };
  const ctl = findCurveCtl(curveControls, key);
  return ctl ? { x: ctl.x, y: ctl.y } : null;
}

/**
 * 수구 경로: 직선 시연 폴리라인 [cue, spot0, …] + 세그먼트별 곡선 제어
 * @returns spotEndVertexIndices[i] = 스팟 i 끝에 해당하는 마지막 꼭짓점 인덱스
 */
export function buildCueCurvedPlaybackPolyline(
  polyStraight: NormPoint[],
  pathPoints: NanguPathPoint[],
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes?: NanguCurveNode[] | undefined
): { vertices: NormPoint[]; spotEndVertexIndices: number[] } {
  if (polyStraight.length < 2 || pathPoints.length < 1) {
    return { vertices: polyStraight, spotEndVertexIndices: polyStraight.length > 1 ? [polyStraight.length - 1] : [0] };
  }
  const spotEndVertexIndices: number[] = [];
  const out: NormPoint[] = [];
  for (let i = 0; i < pathPoints.length; i++) {
    const p0 = polyStraight[i]!;
    const p2 = polyStraight[i + 1]!;
    const key = cueSegmentCurveKey(pathPoints, i);
    const ctl = findCuePlaybackControlNorm(key, curveControls, curveNodes);
    const seg = buildCurveSegmentPoints({
      start: p0,
      end: p2,
      curveNode: ctl,
      segments: DEFAULT_QUADRATIC_BEZIER_SEGMENTS,
    });
    if (i === 0) {
      out.push(...seg);
    } else {
      out.push(...seg.slice(1));
    }
    spotEndVertexIndices.push(out.length - 1);
  }
  return { vertices: out, spotEndVertexIndices };
}

/**
 * 1목 경로: 직선 시연 폴리라인 [시작, 스팟0, …] + 세그먼트별 곡선 제어
 * (수구 `buildCueCurvedPlaybackPolyline`와 동일: `buildCurveSegmentPoints` + 세그먼트 이어붙이기)
 */
export function buildObjectCurvedPlaybackPolyline(
  polyStraight: NormPoint[],
  objectPathPoints: NanguPathPoint[],
  curveControls: PathSegmentCurveControl[] | undefined,
  curveNodes?: NanguCurveNode[] | undefined
): { vertices: NormPoint[]; spotEndVertexIndices: number[] } {
  if (polyStraight.length < 2 || objectPathPoints.length < 1) {
    return { vertices: polyStraight, spotEndVertexIndices: polyStraight.length > 1 ? [polyStraight.length - 1] : [0] };
  }
  const spotEndVertexIndices: number[] = [];
  const out: NormPoint[] = [];
  for (let i = 0; i < objectPathPoints.length; i++) {
    const p0 = polyStraight[i]!;
    const p2 = polyStraight[i + 1]!;
    const key = objectSegmentCurveKey(objectPathPoints, i);
    const ctl = findObjectPlaybackControlNorm(key, curveControls, curveNodes);
    const seg = buildCurveSegmentPoints({
      start: p0,
      end: p2,
      curveNode: ctl,
      segments: DEFAULT_QUADRATIC_BEZIER_SEGMENTS,
    });
    if (i === 0) {
      out.push(...seg);
    } else {
      out.push(...seg.slice(1));
    }
    spotEndVertexIndices.push(out.length - 1);
  }
  return { vertices: out, spotEndVertexIndices };
}

/** 곡률 지표 (구간별) — 추후 곡선 감속 규칙에 사용 */
export function quadraticBezierCurvatureMetric(p0: NormPoint, p1: NormPoint, p2: NormPoint): number {
  const chord = Math.hypot(p2.x - p0.x, p2.y - p0.y) || 1e-9;
  const mx = (p0.x + p2.x) / 2;
  const my = (p0.y + p2.y) / 2;
  const dist = Math.hypot(p1.x - mx, p1.y - my);
  return dist / chord;
}
