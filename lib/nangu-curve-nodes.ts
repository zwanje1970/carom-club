/**
 * 곡선 경로 노드 — 직선 pathPoints / objectPathPoints와 별개.
 * segmentKey는 `cueSegmentCurveKey` / `objectSegmentCurveKey`와 동일 규약(path-curve-display).
 * (1단계: 저장·편집기 상태만 — 렌더·재생 미사용)
 */

import type { NanguCurveNode, NanguPathPoint } from "@/lib/nangu-types";
import { isValidCueCurveKey, isValidObjectCurveKey } from "@/lib/path-curve-display";

export function cloneNanguCurveNodes(nodes: NanguCurveNode[]): NanguCurveNode[] {
  return nodes.map((n) => ({ ...n }));
}

export function pruneCuePathCurveNodes(
  nodes: NanguCurveNode[],
  pathPoints: NanguPathPoint[]
): NanguCurveNode[] {
  return nodes.filter((n) => isValidCueCurveKey(n.segmentKey, pathPoints));
}

export function pruneObjectPathCurveNodes(
  nodes: NanguCurveNode[],
  objectPathPoints: NanguPathPoint[]
): NanguCurveNode[] {
  return nodes.filter((n) => isValidObjectCurveKey(n.segmentKey, objectPathPoints));
}
