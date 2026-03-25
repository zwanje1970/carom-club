import type { CueBallType } from "@/lib/billiard-table-constants";

export type { ObjectBallType } from "@/lib/billiard-table-constants";

/** 3구 색(수구·1목 판별에 사용) */
export type ObjectBallColorKey = "red" | "yellow" | "white";

export interface LabeledBallNorm {
  key: ObjectBallColorKey;
  x: number;
  y: number;
}

/** 원본 공배치 (문제). 저장 후 변경 불가. cueBall은 수구(white|yellow). */
export interface NanguBallPlacement {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
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

/** 진행선 스팟 1개 (정규화 0..1). end = 레일이 아닌 위치에 둔 끝 스팟(화살표로 경로 종료) */
export interface NanguPathPoint {
  id: string;
  x: number;
  y: number;
  type: "ball" | "cushion" | "free" | "end";
}

/**
 * 곡선 경로 노드(후속 단계 렌더·재생용). 직선 스팟 배열과 별도 저장.
 * `segmentKey`는 `lib/path-curve-display`의 cue/object 세그먼트 키 규약과 동일.
 */
export interface NanguCurveNode {
  segmentKey: string;
  x: number;
  y: number;
}

/** 해법 경로 1개: 스팟을 순서대로 연결. 마지막 선에는 화살표 표시 */
export interface NanguSolutionPath {
  points: { x: number; y: number }[]; // 정규화 0..1 (레거시 호환)
  /** 스팟 상세 (타입 포함). 있으면 이걸 우선 사용 */
  pointsWithType?: NanguPathPoint[];
}
