/**
 * 난구해결사 데이터 타입
 * - 원본 공배치: 게시 후 수정 불가, 보기 전용
 * - 해법: 별도 레이어, 좌표 기반 저장 (자동 물리 계산 없음, 사용자 수동 조작)
 * - 수구(cueBall): white | yellow만.
 *
 * ### 1목적구 (난구해법 제시)
 * - **상태로 고정 저장하지 않음.** 현재 `pathPoints`·`objectPathPoints`에서만 파생 (`lib/trouble-first-object-ball.ts`).
 * - 수구를 제외한 두 공 중, **활성 경로 순서상 가장 먼저 나온 `type==="ball"` 스팟**(탭 반경 내 비수구 공에 대응)이 1목이다.
 * - 수구 경로를 앞에서부터 스캔한 뒤, 유효한 공 스팟이 없으면 1목 경로를 앞에서부터 스캔한다. 광선·가까운 공 폴백 없음.
 * - 스팟이 사라지면 즉시 `null`; 다른 공에 먼저 스팟이 찍히면 그 공으로 변경.
 */

import type { CueBallType } from "./billiard-table-constants";
import type { PathSegmentCurveControl } from "./path-curve-display";

export type { ObjectBallType } from "./billiard-table-constants";

/** 3구 색(수구·1목 판별에 사용) */
export type ObjectBallColorKey = "red" | "yellow" | "white";

export interface LabeledBallNorm {
  key: ObjectBallColorKey;
  x: number;
  y: number;
}

/** 수구가 아닌 두 공(1목 후보) — 경로 스냅·충돌 광선의 먼저 맞는 공 판별에 사용 */
export function getNonCueBallNorms(placement: NanguBallPlacement): LabeledBallNorm[] {
  const { redBall, yellowBall, whiteBall, cueBall } = placement;
  if (cueBall === "white") {
    return [
      { key: "red", x: redBall.x, y: redBall.y },
      { key: "yellow", x: yellowBall.x, y: yellowBall.y },
    ];
  }
  return [
    { key: "red", x: redBall.x, y: redBall.y },
    { key: "white", x: whiteBall.x, y: whiteBall.y },
  ];
}

/** 원본 공배치 (문제). 저장 후 변경 불가. cueBall은 수구(white|yellow). */
export interface NanguBallPlacement {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
}

/** 해법 계산/입력 시 수구·1목 분리. 1목은 수구 제외 두 공 중 하나의 위치. */
export interface NanguSolutionInput {
  cueBallType: CueBallType;
  cueBallPosition: { x: number; y: number };
  objectBallPosition: { x: number; y: number };
}

/** 난구해결사로 넘어오는 원본 데이터 (제목, 설명, 공 좌표, 수구 표시) */
export interface NanguSourceLayout {
  title: string;
  description: string;
  balls: Array<{
    id: string;
    color: "red" | "yellow" | "white";
    x: number;
    y: number;
    isCue: boolean;
  }>;
}

/** NanguBallPlacement → NanguSourceLayout 변환 */
export function ballPlacementToSourceLayout(
  title: string,
  description: string,
  placement: NanguBallPlacement
): NanguSourceLayout {
  const { redBall, yellowBall, whiteBall, cueBall } = placement;
  const balls = [
    { id: "red", color: "red" as const, ...redBall, isCue: false },
    { id: "yellow", color: "yellow" as const, ...yellowBall, isCue: cueBall === "yellow" },
    { id: "white", color: "white" as const, ...whiteBall, isCue: cueBall === "white" },
  ];
  return { title, description, balls };
}

/** 진행선 스팟 1개 (정규화 0..1). end = 레일이 아닌 위치에 둔 끝 스팟(화살표로 경로 종료) */
export interface NanguPathPoint {
  id: string;
  x: number;
  y: number;
  type: "ball" | "cushion" | "free" | "end";
}

/** 해법 경로 1개: 스팟을 순서대로 연결. 마지막 선에는 화살표 표시 */
export interface NanguSolutionPath {
  points: { x: number; y: number }[]; // 정규화 0..1 (레거시 호환)
  /** 스팟 상세 (타입 포함). 있으면 이걸 우선 사용 */
  pointsWithType?: NanguPathPoint[];
}

/** 해법 데이터 (이미지 아님, 좌표 기반) */
export interface NanguSolutionData {
  /** 뱅크샷 모드면 두께 단계 생략, 수구 1개+당점+선만 */
  isBankShot: boolean;
  /** 두께: 목적구 고정 상태에서 수구 좌우 오프셋 (정규화). 비뱅크샷만 */
  thicknessOffsetX?: number;
  /** 당점: 수구 내부 정규화 -1~1 (spinX, spinY) */
  tipX?: number;
  tipY?: number;
  /** 레거시: tipX/tipY를 0.5 중심 0..1로 쓰는 경우 */
  spinX?: number;
  spinY?: number;
  /** 수구 경로들 (진행선: 수구에서 시작, 스팟은 공/쿠션/자유) */
  paths: NanguSolutionPath[];
  /** 1목적구 반사각 경로 (선택) */
  reflectionPath?: NanguSolutionPath;
  /** 1목 경로 재생 시 이동하는 공(수구 제외 2개 중 실제 맞은 쪽). 없으면 red로 간주(구버전) */
  reflectionObjectBall?: ObjectBallColorKey;
  /** 백스트로크 0~10 (오른쪽=짧음, 왼쪽=김) */
  backstrokeLevel?: number;
  /** 팔로우스트로크 0~10 (왼쪽=짧음, 오른쪽=김) */
  followStrokeLevel?: number;
  /** 볼 스피드 1.0~5.0 (0.5 단계). 있으면 거리·시간 계산에 우선 */
  ballSpeed?: number;
  /** 볼스피드 1~10 (레일 1~5 참고, 레거시·동기화용) */
  speedLevel?: number;
  /** 속도 1~5 (레거시) */
  speed?: number;
  /** 깊이 1~5 (선택) */
  depth?: number;
  /** 해설 텍스트 */
  explanationText?: string;
  /**
   * 표시 전용 곡선(선분당 2차 베지어 제어점). 직선 paths/reflectionPath와 별개.
   * 판정·재생·충돌에는 사용하지 않음.
   */
  cuePathDisplayCurves?: PathSegmentCurveControl[];
  objectPathDisplayCurves?: PathSegmentCurveControl[];
}
