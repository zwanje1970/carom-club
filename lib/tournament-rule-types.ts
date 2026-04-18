/** 클라이언트·API 공용 — dev-store 규칙 스냅샷과 동일한 문자열 유니온 (서버 구현과 맞출 것) */

export type TournamentEntryQualificationType = "NONE" | "SCORE" | "EVER" | "BOTH";
export type TournamentVerificationMode = "NONE" | "AUTO" | "MANUAL";
export type TournamentEligibilityType = "NONE" | "UNDER";
export type TournamentDivisionMetricType = "AVERAGE" | "SCORE";
export type TournamentScope = "REGIONAL" | "NATIONAL";
/** 1일 또는 복수 일(일 수는 `durationDays`로 저장, 2~10). 저장 데이터의 구 `2_DAYS`/`3_PLUS`는 로드 시 `MULTI_DAY`로 정규화 */
export type TournamentDurationType = "1_DAY" | "MULTI_DAY";
export type TournamentTeamScoreRule = "LTE" | "LT";
