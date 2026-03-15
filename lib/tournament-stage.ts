/**
 * 13: 대회 진행 상태 (권역 예선 → 본선).
 * 상태 기준으로 권역 수정/진출자 취합/본선 생성 허용 여부 판단.
 */
export const TOURNAMENT_STAGES = [
  "SETUP",
  "QUALIFIER_RUNNING",
  "QUALIFIER_COMPLETED",
  "FINAL_READY",
  "FINAL_RUNNING",
  "COMPLETED",
] as const;

export type TournamentStage = (typeof TOURNAMENT_STAGES)[number];

const STAGE_ORDER: Record<TournamentStage, number> = {
  SETUP: 0,
  QUALIFIER_RUNNING: 1,
  QUALIFIER_COMPLETED: 2,
  FINAL_READY: 3,
  FINAL_RUNNING: 4,
  COMPLETED: 5,
};

/** FINAL_READY 이상이면 권역 예선 결과/규칙/배정 수정 금지 */
export function isQualifierLocked(stage: string | null | undefined): boolean {
  if (!stage) return false;
  const order = STAGE_ORDER[stage as TournamentStage];
  return typeof order === "number" && order >= STAGE_ORDER.FINAL_READY;
}

/** 진출자 취합 허용: SETUP, QUALIFIER_RUNNING, QUALIFIER_COMPLETED 만 */
export function isCollectAllowed(stage: string | null | undefined): boolean {
  if (!stage) return true;
  const order = STAGE_ORDER[stage as TournamentStage];
  return typeof order === "number" && order < STAGE_ORDER.FINAL_READY;
}

export function parseStage(stage: string | null | undefined): TournamentStage {
  if (stage && TOURNAMENT_STAGES.includes(stage as TournamentStage)) return stage as TournamentStage;
  return "SETUP";
}

export const STAGE_LABELS: Record<TournamentStage, string> = {
  SETUP: "설정",
  QUALIFIER_RUNNING: "권역 예선 진행 중",
  QUALIFIER_COMPLETED: "권역 예선 완료",
  FINAL_READY: "본선 준비",
  FINAL_RUNNING: "본선 진행 중",
  COMPLETED: "종료",
};
