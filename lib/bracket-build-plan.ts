/**
 * 운영 콘솔 "대진 생성 계획" 계산 — 입력/출력 구조를 실제 스케줄링·엔진과 연결하기 위한 1차 모델.
 * 단판 토너먼트(싱글 엘리미네이션) 기준, 관리자 대진 생성 API의 nextBracketSize 규칙(최대 64)과 맞춤.
 */

export type BracketBuildGameFormat = "single_elim_tournament";

/** 좌측 패널 입력 (저장/전송 가능한 순수 값) */
export interface BracketBuildInputs {
  /** DB 기준 확정 참가자 수(엔트리 행 수) */
  confirmedParticipantCount: number;
  gameFormat: BracketBuildGameFormat;
  venueCount: number;
  /** 경기장마다 동일한 테이블 수(추후 경기장별 배열로 확장) */
  tablesPerVenue: number;
  /** 1경기(또는 1슬롯) 기준 소요 분 */
  baseMatchDurationMinutes: number;
  /** 라운드 전환·집합 등 고정 버퍼(분) */
  turnoverMinutesBetweenRounds: number;
  /** 부수별 시간 규칙 — 현재는 메모만, 계산에는 미반영(경고/로그용) */
  divisionTimeRulesNotes: string;
  /** true면 병렬 처리능력을 보수적으로 절반 가정 */
  separateByDivision: boolean;
  /** 동시 처리 슬롯 여유(추가 테이블 슬롯으로 간주) */
  exceptionAllowanceCount: number;
  /** 일정 시작 시각 */
  scheduleStartAt: Date;
}

export interface BracketBuildRoundEstimate {
  roundIndex: number;
  matchesInRound: number;
  parallelBatches: number;
  estimatedMinutesThisRound: number;
}

export interface BracketBuildVenueRow {
  venueIndex: number;
  tables: number;
  maxParallelMatchesThisVenue: number;
  note: string;
}

/** 우측 패널 출력 */
export interface BracketBuildPlanResult {
  inputsEcho: BracketBuildInputs;
  bracketSlotSize: number;
  byeCount: number;
  totalMatches: number;
  roundCount: number;
  parallelCapacityRaw: number;
  parallelCapacityEffective: number;
  estimatedTotalMinutes: number;
  estimatedEndAt: Date;
  rounds: BracketBuildRoundEstimate[];
  venueRows: BracketBuildVenueRow[];
  warnings: string[];
  errors: string[];
  /** 서버 생성 API까지 포함한 실무 가능 여부 힌트(클라이언트에서 컨텍스트와 결합) */
  planComputationOk: boolean;
}

/** admin bracket/generate 의 nextBracketSize 와 동일 */
export function nextBracketSlotSizeForPlan(count: number): number {
  if (count <= 0) return 0;
  let size = 4;
  while (size < count && size < 64) size *= 2;
  return size;
}

/**
 * 확정 인원·경기장·시간 가정으로 라운드별 배치·총 소요 시간 추정.
 */
export function computeBracketBuildPlan(inputs: BracketBuildInputs): BracketBuildPlanResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const n = inputs.confirmedParticipantCount;
  const v = Math.max(0, Math.floor(inputs.venueCount));
  const t = Math.max(0, Math.floor(inputs.tablesPerVenue));
  const base = Math.max(0, inputs.baseMatchDurationMinutes);
  const turnover = Math.max(0, inputs.turnoverMinutesBetweenRounds);
  const allowance = Math.max(0, Math.floor(inputs.exceptionAllowanceCount));

  if (n < 2) errors.push("확정 참가자가 2명 미만이면 단판 토너먼트를 구성할 수 없습니다.");
  if (v < 1) errors.push("경기장 수는 1 이상이어야 합니다.");
  if (t < 1) errors.push("경기장별 테이블 수는 1 이상이어야 합니다.");
  if (base < 1) errors.push("기준 경기시간(분)은 1 이상이어야 합니다.");
  if (Number.isNaN(inputs.scheduleStartAt.getTime())) errors.push("시작 시간이 올바르지 않습니다.");

  const S = n >= 2 ? nextBracketSlotSizeForPlan(n) : 0;
  const byes = S > 0 ? S - n : 0;
  const totalMatches = S > 0 ? S - 1 : 0;

  const parallelRaw = v * t;
  let parallelEff = Math.max(1, parallelRaw + allowance);
  if (inputs.separateByDivision) {
    parallelEff = Math.max(1, Math.floor(parallelEff / 2));
    warnings.push("부수 분리 옵션: 동시 처리 슬롯을 보수적으로 1/2로 가정했습니다.");
  }

  const rounds: BracketBuildRoundEstimate[] = [];
  let totalMin = 0;
  let roundIndex = 0;
  for (let matches = S >= 2 ? S / 2 : 0; matches >= 1; matches = Math.floor(matches / 2)) {
    const batches = Math.ceil(matches / parallelEff);
    const roundMin = batches * base;
    rounds.push({
      roundIndex,
      matchesInRound: matches,
      parallelBatches: batches,
      estimatedMinutesThisRound: roundMin,
    });
    totalMin += roundMin;
    if (matches > 1) totalMin += turnover;
    roundIndex++;
  }

  const estimatedEndAt = new Date(inputs.scheduleStartAt.getTime() + totalMin * 60 * 1000);

  if (byes > 0) warnings.push(`브래킷 크기 ${S}명 기준 부전승(빈 슬롯) ${byes}건이 발생합니다.`);

  if (inputs.divisionTimeRulesNotes.trim()) {
    warnings.push("부수별 시간 규칙 메모가 있으나, 현재 버전 계산에는 반영되지 않았습니다(추후 엔진 연동).");
  }

  if (S >= 64 && n > 32) {
    warnings.push("참가자 규모가 커서 브래킷 상한(64슬롯)에 도달할 수 있습니다. 운영 규칙을 확인하세요.");
  }

  const venueRows: BracketBuildVenueRow[] = [];
  for (let i = 0; i < v; i++) {
    venueRows.push({
      venueIndex: i + 1,
      tables: t,
      maxParallelMatchesThisVenue: t,
      note: `동시 최대 ${t}경기(해당 경기장)`,
    });
  }

  const planComputationOk = errors.length === 0 && S >= 2 && totalMatches >= 1;

  return {
    inputsEcho: inputs,
    bracketSlotSize: S,
    byeCount: byes,
    totalMatches,
    roundCount: rounds.length,
    parallelCapacityRaw: parallelRaw,
    parallelCapacityEffective: parallelEff,
    estimatedTotalMinutes: totalMin,
    estimatedEndAt,
    rounds,
    venueRows,
    warnings,
    errors,
    planComputationOk,
  };
}
