/**
 * 난구해결사 데이터 타입
 * - 원본 공배치: 게시 후 수정 불가, 보기 전용
 * - 해법: 별도 레이어, 좌표 기반 저장
 */

import type { CueBallType } from "./billiard-table-constants";

/** 원본 공배치 (문제). 저장 후 변경 불가 */
export interface NanguBallPlacement {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
}

/** 해법 경로 1개: 스팟을 순서대로 연결. 마지막 선에는 화살표 표시 */
export interface NanguSolutionPath {
  points: { x: number; y: number }[]; // 정규화 0..1
}

/** 해법 데이터 (이미지 아님, 좌표 기반) */
export interface NanguSolutionData {
  /** 뱅크샷 모드면 두께 단계 생략, 수구 1개+당점+선만 */
  isBankShot: boolean;
  /** 두께: 목적구 고정 상태에서 수구 좌우 오프셋 (정규화). 비뱅크샷만 */
  thicknessOffsetX?: number;
  /** 당점: 수구 내부 정규화 (0.5,0.5=중심). 공 반지름 67.4% 이내 */
  tipX?: number;
  tipY?: number;
  /** 수구 경로들 (여러 path 가능) */
  paths: NanguSolutionPath[];
  /** 1목적구 반사각 경로 (선택) */
  reflectionPath?: NanguSolutionPath;
  /** 속도 1~5 (선택) */
  speed?: number;
  /** 깊이 1~5 (선택) */
  depth?: number;
}
