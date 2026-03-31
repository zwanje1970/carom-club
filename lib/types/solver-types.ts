import type { PathSegmentCurveControl } from "@/lib/path-curve-display";
import type { SolutionSettingsValue } from "@/lib/solution-settings-panel-value";
import type {
  NanguCurveNode,
  NanguSolutionPath,
} from "@/lib/types/shared-types";
import type { CueBallType } from "@/lib/billiard-table-constants";
import type { ObjectBallColorKey } from "@/lib/types/shared-types";

/** 해법 계산/입력 시 수구·1목 분리. 1목은 수구 제외 두 공 중 하나의 위치. */
export interface NanguSolutionInput {
  cueBallType: CueBallType;
  cueBallPosition: { x: number; y: number };
  objectBallPosition: { x: number; y: number };
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
  /** 1목적구 반사 경로 재생 시 움직이는 공의 색 키. 없으면 재생·빌더에서 경로/스팟으로 해석(특정 색 기본값 없음) */
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
  /** 표시용 베지어와 별개 — 곡선 노드(후속 단계). 직선 paths/reflectionPath와 별개 */
  cuePathCurveNodes?: NanguCurveNode[];
  objectPathCurveNodes?: NanguCurveNode[];
  /** 미니 설정 패널 값(배치·당점·스트로크 표시용) — 물리·재생과 별도 */
  settings?: SolutionSettingsValue;
}
