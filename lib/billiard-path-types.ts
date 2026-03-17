/**
 * 경로·마커·해법 패널 데이터 구조 (확장용)
 * - 기존 BilliardNote 저장 구조는 변경하지 않음.
 * - 난구풀이/해법 작성에서 paths, shotPanel, markers 사용.
 */

/** 단일 경로: 수구에서 시작 또는 자유 시작 + 스팟포인트 배열 (정규화 0..1) */
export interface BilliardPath {
  start:
    | { type: "cueBall" }
    | { type: "free"; x: number; y: number };
  /** 최대 11개 */
  points: { x: number; y: number }[];
}

/** 설명용 마커 (후속 렌더링) */
export type BilliardMarkerType = "dot" | "x";

export interface BilliardMarker {
  x: number;
  y: number;
  type: BilliardMarkerType;
}

/** 해법 패널 확장 데이터 (저장 구조 준비, 당구노트 스키마는 미수정) */
export interface BilliardShotPanelData {
  /** 두께: 수구-목적구 겹침 정도 등 */
  thickness?: number;
  /** 당점: 공 위 점 위치 (정규화 또는 각도) */
  tipPosition?: { x: number; y: number };
  /** 속도 1~5 */
  speedLevel?: number;
  /** 큐깊이 1~5 */
  strokeDepth?: number;
}

/** 두께+당점 통합 패널 저장값 (해법 설명용) */
export interface BilliardContactPanelData {
  /** 수구 오프셋: 0.5,0.5 = 겹침 최대, 겹침 정도 = 두께 */
  thicknessPosition?: { x: number; y: number };
  /** 당점: 수구 내부 좌표 0..1 (0.5,0.5 = 중심) */
  tipPosition?: { x: number; y: number };
  /** 방향 라벨 (예: "9시 방향") */
  directionLabel?: string;
  /** 팁 수 (예: 3) */
  tipCount?: number;
  /** 속도 단계 1~5 */
  speedLevel?: number;
  /** 깊이 단계 1~5 */
  strokeDepth?: number;
}
