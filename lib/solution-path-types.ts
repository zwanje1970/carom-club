/**
 * 난구해결사 경로선/스팟 공통 데이터 (1단계)
 * - 곡선 없음: 스팟 순서대로 직선 연결
 */

export type SolutionPathPointType = "normal" | "cushion" | "end";

/** 정규화 좌표(0~1) 기준 스팟 */
export interface SolutionPathPoint {
  id: string;
  x: number;
  y: number;
  type: SolutionPathPointType;
}

export interface SolutionPathSegment {
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface SolutionPath {
  id: string;
  /** CSS/Canvas stroke용 */
  color: string;
  points: SolutionPathPoint[];
  segments: SolutionPathSegment[];
}

/** 수구 → 사용자 스팟들을 순서대로 연결한 선분 (항상 수구에서 시작, 수구는 points에 포함하지 않음) */
export function buildCuePathSegments(
  cue: { x: number; y: number },
  spots: Pick<SolutionPathPoint, "x" | "y">[]
): SolutionPathSegment[] {
  if (spots.length === 0) return [];
  const segs: SolutionPathSegment[] = [];
  let prev = { x: cue.x, y: cue.y };
  for (const p of spots) {
    segs.push({ start: { ...prev }, end: { x: p.x, y: p.y } });
    prev = { x: p.x, y: p.y };
  }
  return segs;
}

/** 1목적구 경로: 충돌점 → 스팟들 (충돌점은 points[0]에 넣지 않고 segments만 생성할 때 사용) */
export function buildObjectPathSegments(
  collision: { x: number; y: number },
  spots: Pick<SolutionPathPoint, "x" | "y">[]
): SolutionPathSegment[] {
  return buildCuePathSegments(collision, spots);
}
