/**
 * 난구해결사 데이터 타입
 * - 원본 공배치: 게시 후 수정 불가, 보기 전용
 * - 해법: 별도 레이어, 좌표 기반 저장 (자동 물리 계산 없음, 사용자 수동 조작)
 * - 수구(cueBall): white | yellow만. red는 목적구로만 사용.
 */

import type { CueBallType } from "./billiard-table-constants";

export type { ObjectBallType } from "./billiard-table-constants";

/** 원본 공배치 (문제). 저장 후 변경 불가. cueBall은 수구(white|yellow), red는 목적구. */
export interface NanguBallPlacement {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
}

/** 해법 계산/입력 시 수구·목적구 분리. cueBallType에 red 불가. */
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

/** 진행선 스팟 1개 (정규화 0..1, 타입: 공/쿠션/자유) */
export interface NanguPathPoint {
  id: string;
  x: number;
  y: number;
  type: "ball" | "cushion" | "free";
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
  /** 백스트로크 0~10 (오른쪽=짧음, 왼쪽=김) */
  backstrokeLevel?: number;
  /** 팔로우스트로크 0~10 (왼쪽=짧음, 오른쪽=김) */
  followStrokeLevel?: number;
  /** 볼스피드 1~10 (레일 1~5 참고) */
  speedLevel?: number;
  /** 속도 1~5 (레거시) */
  speed?: number;
  /** 깊이 1~5 (선택) */
  depth?: number;
  /** 해설 텍스트 */
  explanationText?: string;
}
