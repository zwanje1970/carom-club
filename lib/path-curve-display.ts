/**
 * 난구/경로 편집기 — 표시 전용 2차 베지어(선분당 제어점 1개).
 * pathPoints / objectPathPoints 직선 데이터와 완전 분리; 판정·재생·충돌 로직에 사용하지 않음.
 */

import type { NanguPathPoint } from "@/lib/nangu-types";

export interface PathSegmentCurveControl {
  /** `CUE|<firstSpotId>` 또는 `<spotId>|<spotId>` (인접 스팟) */
  key: string;
  /** landscape 플레이필드 정규화 좌표 (0~1) — 베지어 제어점 */
  x: number;
  y: number;
}

const CUE_KEY = (firstSpotId: string) => `CUE|${firstSpotId}`;
const OBJ_KEY = (firstSpotId: string) => `OBJ|${firstSpotId}`;
const CHAIN_KEY = (a: string, b: string) => `${a}|${b}`;

/** 수구 경로 segmentIndex: 0 = 수구→첫 스팟, i = 스팟[i-1]→스팟[i] */
export function cueSegmentCurveKey(
  pathPoints: NanguPathPoint[],
  segmentIndex: number
): string | null {
  if (pathPoints.length < 1) return null;
  if (segmentIndex < 0 || segmentIndex >= pathPoints.length) return null;
  if (segmentIndex === 0) return CUE_KEY(pathPoints[0]!.id);
  return CHAIN_KEY(pathPoints[segmentIndex - 1]!.id, pathPoints[segmentIndex]!.id);
}

/** 1목 경로 segmentIndex: 0 = 충돌점→첫 스팟, i = 스팟[i-1]→스팟[i] */
export function objectSegmentCurveKey(
  objectPathPoints: NanguPathPoint[],
  segmentIndex: number
): string | null {
  if (objectPathPoints.length < 1) return null;
  if (segmentIndex < 0 || segmentIndex >= objectPathPoints.length) return null;
  if (segmentIndex === 0) return OBJ_KEY(objectPathPoints[0]!.id);
  return CHAIN_KEY(objectPathPoints[segmentIndex - 1]!.id, objectPathPoints[segmentIndex]!.id);
}

export function isValidCueCurveKey(key: string, pathPoints: NanguPathPoint[]): boolean {
  if (pathPoints.length < 1) return false;
  if (key.startsWith("CUE|")) {
    return pathPoints[0]!.id === key.slice(4);
  }
  const pipe = key.indexOf("|");
  if (pipe <= 0) return false;
  const a = key.slice(0, pipe);
  const b = key.slice(pipe + 1);
  for (let i = 0; i < pathPoints.length - 1; i++) {
    if (pathPoints[i]!.id === a && pathPoints[i + 1]!.id === b) return true;
  }
  return false;
}

export function isValidObjectCurveKey(key: string, objectPathPoints: NanguPathPoint[]): boolean {
  if (objectPathPoints.length < 1) return false;
  if (key.startsWith("OBJ|")) {
    return objectPathPoints[0]!.id === key.slice(4);
  }
  const pipe = key.indexOf("|");
  if (pipe <= 0) return false;
  const a = key.slice(0, pipe);
  const b = key.slice(pipe + 1);
  for (let i = 0; i < objectPathPoints.length - 1; i++) {
    if (objectPathPoints[i]!.id === a && objectPathPoints[i + 1]!.id === b) return true;
  }
  return false;
}

export function pruneCuePathCurveControls(
  controls: PathSegmentCurveControl[],
  pathPoints: NanguPathPoint[]
): PathSegmentCurveControl[] {
  return controls.filter((c) => isValidCueCurveKey(c.key, pathPoints));
}

export function pruneObjectPathCurveControls(
  controls: PathSegmentCurveControl[],
  objectPathPoints: NanguPathPoint[]
): PathSegmentCurveControl[] {
  return controls.filter((c) => isValidObjectCurveKey(c.key, objectPathPoints));
}

export function clonePathCurveControls(c: PathSegmentCurveControl[]): PathSegmentCurveControl[] {
  return c.map((x) => ({ ...x }));
}
