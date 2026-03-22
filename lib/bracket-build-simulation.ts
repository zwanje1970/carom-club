/**
 * 대진 생성 미리보기/검증 엔진 — Match 저장 없음.
 * 단판 토너먼트(싱글 엘리미네이션), 결정론적 슬롯 배치(랜덤 없음).
 *
 * - 슬롯: 확정 엔트리를 id 순 정렬 후 부전승(BYE) 패딩 → nextBracketSlotSize
 * - 1라운드: 인접 슬롯 (2i,2i+1) 짝지어 동일 부수 여부 판정
 * - 이후 라운드: 승자 미정이므로 부수 검증 생략, 부하·시간만 시뮬레이션
 */

import type { BracketBuildInputs } from "@/lib/bracket-build-plan";
import { nextBracketSlotSizeForPlan } from "@/lib/bracket-build-plan";

export type SimulationOverallStatus = "OK" | "WARNING" | "IMPOSSIBLE";

export type ValidationSeverity = "info" | "warn" | "block";

export interface ValidationMessage {
  code: string;
  severity: ValidationSeverity;
  message: string;
}

/** 확정 참가자 1명 — 부수는 TournamentEntry.round 또는 미지정 */
export interface ConfirmedParticipantSlot {
  entryId: string;
  /** 비어 있으면 "미지정" */
  divisionKey: string;
}

export interface VenueBatchDetail {
  roundIndex: number;
  batchIndexInRound: number;
  matchesInBatch: number;
  kPerVenue: number[];
  batchWallMinutes: number;
  /** 해당 배치에서 경기장 v에 동시에 배치된 1라운드 동일 부 대진 수 (라운드 1만) */
  sameDivisionSimultaneousPerVenue?: number[];
}

export interface VenueSimulationSummary {
  venueIndex: number;
  /** 브래킷 전체에서 해당 경기장에 배정된 경기 수(라운드 합) */
  totalMatchesAssigned: number;
  /** 시작 시각 기준 종료까지 분(해당 경기장 마지막 배치 종료) */
  endMinutesFromStart: number;
}

export interface BracketSimulationResult {
  overallStatus: SimulationOverallStatus;
  /** 문제 없을 때도 한 줄 요약 */
  summaryMessage: string;
  validations: ValidationMessage[];
  bracketSlotSize: number;
  byeCount: number;
  totalMatches: number;
  parallelCapacityEffective: number;
  /** 전체 종료(분) = 마지막 배치 종료 시각 */
  globalEndMinutesFromStart: number;
  globalEndAt: Date;
  /** 경기장별 종료 시각 편차(분) — 활동이 있는 경기장만 */
  venueFinishTimeSpreadMinutes: number;
  venueSummaries: VenueSimulationSummary[];
  venueBatchDetails: VenueBatchDetail[];
  /** 라운드별 합계(배치 wall time 합 + 라운드 간 턴오버) */
  roundWallMinutes: number[];
}

function normalizeDivision(d: string | null | undefined): string {
  const s = (d ?? "").trim();
  return s.length ? s : "미지정";
}

/**
 * 슬롯 0..S-1에 참가자 배치(BYE 패딩), 1라운드 짝 (2i,2i+1)
 */
function buildRoundOneMatchMeta(
  S: number,
  participants: ConfirmedParticipantSlot[]
): { isBye: boolean; sameDivision: boolean }[] {
  const sorted = [...participants].sort((a, b) => a.entryId.localeCompare(b.entryId));
  const slots: { entryId: string | null; div: string }[] = sorted.map((p) => ({
    entryId: p.entryId,
    div: normalizeDivision(p.divisionKey),
  }));
  while (slots.length < S) {
    slots.push({ entryId: null, div: "BYE" });
  }
  const M = S / 2;
  const meta: { isBye: boolean; sameDivision: boolean }[] = [];
  for (let i = 0; i < M; i++) {
    const a = slots[i * 2];
    const b = slots[i * 2 + 1];
    const bye = a.entryId == null || b.entryId == null;
    /** 실제 선수끼리 같은 부(문자열 동일) — BYE/미지정도 동일 키로 취급 */
    const sameDivision = !bye && a.div === b.div;
    meta.push({ isBye: bye, sameDivision });
  }
  return meta;
}

/**
 * 배치 내 경기를 슬롯 0..matchCount-1에 올림 → 경기장별 경기 수 (배치마다 0번 슬롯부터 채움)
 * 슬롯 i → venue = floor(i / T), 단 V-1로 상한
 */
function countPerVenueForBatch(
  matchCount: number,
  venueCount: number,
  tablesPerVenue: number
): number[] {
  const T = tablesPerVenue;
  const V = venueCount;
  const k = Array(V).fill(0);
  for (let i = 0; i < matchCount; i++) {
    const v = Math.min(V - 1, Math.floor(i / T));
    k[v]++;
  }
  return k;
}

/**
 * 라운드 1 배치에서 동시에 같은 부수 대진이 경기장에 쌓이는지(결정론적 배치 기준)
 */
function sameDivisionLoadForBatchRoundOne(
  matchStart: number,
  matchCount: number,
  roundOneMeta: { isBye: boolean; sameDivision: boolean }[],
  venueCount: number,
  tablesPerVenue: number
): number[] {
  const T = tablesPerVenue;
  const V = venueCount;
  const same = Array(V).fill(0);
  for (let i = 0; i < matchCount; i++) {
    const mi = matchStart + i;
    if (mi >= roundOneMeta.length) break;
    if (roundOneMeta[mi].isBye || !roundOneMeta[mi].sameDivision) continue;
    const slot = i;
    const v = Math.min(V - 1, Math.floor(slot / T));
    same[v]++;
  }
  return same;
}

/**
 * 단판 토너먼트 스케줄 시뮬레이션 + 검증
 */
export function simulateBracketBuild(
  inputs: BracketBuildInputs,
  participants: ConfirmedParticipantSlot[]
): BracketSimulationResult {
  const validations: ValidationMessage[] = [];
  const n = inputs.confirmedParticipantCount;
  const V = Math.max(0, Math.floor(inputs.venueCount));
  const T = Math.max(0, Math.floor(inputs.tablesPerVenue));
  const base = Math.max(0, inputs.baseMatchDurationMinutes);
  const turnover = Math.max(0, inputs.turnoverMinutesBetweenRounds);
  const allowance = Math.max(0, Math.floor(inputs.exceptionAllowanceCount));

  if (n < 2 || V < 1 || T < 1 || base < 1 || Number.isNaN(inputs.scheduleStartAt.getTime())) {
    return {
      overallStatus: "IMPOSSIBLE",
      summaryMessage: "입력 또는 확정 인원이 유효하지 않아 시뮬레이션을 수행할 수 없습니다.",
      validations: [{ code: "INPUT", severity: "block", message: "필수 입력·확정 인원을 확인하세요." }],
      bracketSlotSize: 0,
      byeCount: 0,
      totalMatches: 0,
      parallelCapacityEffective: 0,
      globalEndMinutesFromStart: 0,
      globalEndAt: inputs.scheduleStartAt,
      venueFinishTimeSpreadMinutes: 0,
      venueSummaries: [],
      venueBatchDetails: [],
      roundWallMinutes: [],
    };
  }

  const S = nextBracketSlotSizeForPlan(n);
  const byeCount = S - n;
  const totalMatches = S - 1;
  const parallelRaw = V * T;
  let Ceff = Math.max(1, parallelRaw + allowance);
  if (inputs.separateByDivision) {
    Ceff = Math.max(1, Math.floor(Ceff / 2));
  }

  if (participants.length !== n) {
    return {
      overallStatus: "IMPOSSIBLE",
      summaryMessage:
        "확정 참가자 스냅샷과 인원 수가 일치하지 않아 시뮬레이션을 수행할 수 없습니다. 페이지를 새로고침하세요.",
      validations: [
        {
          code: "PARTICIPANT_MISMATCH",
          severity: "block",
          message: `확정 참가자 목록(${participants.length}명)과 표시 인원(${n}명)이 일치하지 않습니다.`,
        },
      ],
      bracketSlotSize: S,
      byeCount,
      totalMatches,
      parallelCapacityEffective: Ceff,
      globalEndMinutesFromStart: 0,
      globalEndAt: inputs.scheduleStartAt,
      venueFinishTimeSpreadMinutes: 0,
      venueSummaries: [],
      venueBatchDetails: [],
      roundWallMinutes: [],
    };
  }

  const roundOneMeta = buildRoundOneMatchMeta(S, participants);

  let globalMin = 0;
  const venueLastEnd = Array(V).fill(0);
  const venueTotalMatches = Array(V).fill(0);
  const venueBatchDetails: VenueBatchDetail[] = [];
  const roundWallMinutes: number[] = [];

  let roundIndex = 0;
  for (let matchesInRound = S / 2; matchesInRound >= 1; matchesInRound = Math.floor(matchesInRound / 2)) {
    let remaining = matchesInRound;
    let matchOffset = 0;
    let batchInRound = 0;
    let roundMinutes = 0;

    while (remaining > 0) {
      const batchSize = Math.min(Ceff, remaining);
      const kPerVenue = countPerVenueForBatch(batchSize, V, T);

      let batchWall = 0;
      for (let v = 0; v < V; v++) {
        const kv = kPerVenue[v];
        if (kv === 0) continue;
        const waves = Math.ceil(kv / T);
        const local = waves * base;
        batchWall = Math.max(batchWall, local);
        venueTotalMatches[v] += kv;

        const maxWavesAllowed = 1 + allowance;
        if (waves > maxWavesAllowed) {
          validations.push({
            code: "VENUE_WAVE_OVER",
            severity: "block",
            message: `라운드 ${roundIndex + 1} 배치 ${batchInRound + 1}: 경기장 ${v + 1}에서 연속 웨이브 ${waves}회 필요(허용 ${maxWavesAllowed}회). 예외 허용·테이블·경기장을 조정하세요.`,
          });
        } else if (waves > 1) {
          validations.push({
            code: "VENUE_WAVE",
            severity: "warn",
            message: `라운드 ${roundIndex + 1} 배치 ${batchInRound + 1}: 경기장 ${v + 1}에서 동시 테이블 초과로 ${waves}웨이브 가정.`,
          });
        }
      }

      let sameDivPerVenue: number[] | undefined;
      if (roundIndex === 0) {
        const absStart = matchOffset;
        sameDivPerVenue = sameDivisionLoadForBatchRoundOne(absStart, batchSize, roundOneMeta, V, T);
        for (let v = 0; v < V; v++) {
          if (sameDivPerVenue[v] > T) {
            validations.push({
              code: "DIV_STACK",
              severity: "warn",
              message: `1라운드 배치 ${batchInRound + 1}: 경기장 ${v + 1}에 동일 부 대진이 동시에 ${sameDivPerVenue[v]}건(테이블 ${T}대 초과 가능).`,
            });
          }
        }
      }

      roundMinutes += batchWall;
      globalMin += batchWall;

      for (let v = 0; v < V; v++) {
        if (kPerVenue[v] > 0) venueLastEnd[v] = globalMin;
      }

      venueBatchDetails.push({
        roundIndex,
        batchIndexInRound: batchInRound,
        matchesInBatch: batchSize,
        kPerVenue,
        batchWallMinutes: batchWall,
        sameDivisionSimultaneousPerVenue: sameDivPerVenue,
      });

      remaining -= batchSize;
      matchOffset += batchSize;
      batchInRound++;
    }

    roundWallMinutes.push(roundMinutes);
    if (matchesInRound > 1) {
      globalMin += turnover;
    }
    roundIndex++;
  }

  const activeEnds = venueLastEnd.filter((_, v) => venueTotalMatches[v] > 0);
  const spread =
    activeEnds.length > 1 ? Math.max(...activeEnds) - Math.min(...activeEnds) : 0;
  if (spread > base * 2) {
    validations.push({
      code: "VENUE_TIME_SPREAD",
      severity: "warn",
      message: `경기장 간 마지막 배치 종료 시각 편차 약 ${Math.round(spread)}분 — 일부 경기장 유휴/집중이 큽니다.`,
    });
  }

  /** 부수 집중도: 1라운드 동일 부 대진 비율 */
  const r1Same = roundOneMeta.filter((m) => !m.isBye && m.sameDivision).length;
  const r1Real = roundOneMeta.filter((m) => !m.isBye).length;
  if (r1Real > 0 && r1Same / r1Real > 0.35) {
    validations.push({
      code: "DIV_CLUSTER",
      severity: "warn",
      message: `1라운드에서 동일 부 내부 대진 비율이 ${Math.round((100 * r1Same) / r1Real)}%입니다. 시드/부 배정을 검토하세요.`,
    });
  }

  const divCounts = new Map<string, number>();
  for (const p of participants) {
    const k = normalizeDivision(p.divisionKey);
    divCounts.set(k, (divCounts.get(k) ?? 0) + 1);
  }
  const maxDiv = Math.max(0, ...[...divCounts.values()]);
  if (n > 0 && maxDiv / n > 0.55) {
    validations.push({
      code: "DIV_IMBALANCE",
      severity: "warn",
      message: `특정 부(최대 ${maxDiv}명) 비중이 높습니다. 대진 쏠림 위험이 있습니다.`,
    });
  }

  if (byeCount > 0) {
    validations.push({
      code: "BYE",
      severity: "info",
      message: `부전승 슬롯 ${byeCount}건(브래킷 ${S}강).`,
    });
  }

  const hasBlock = validations.some((x) => x.severity === "block");
  const hasWarn = validations.some((x) => x.severity === "warn");

  const globalEndAt = new Date(inputs.scheduleStartAt.getTime() + globalMin * 60 * 1000);

  const venueSummaries: VenueSimulationSummary[] = [];
  for (let v = 0; v < V; v++) {
    venueSummaries.push({
      venueIndex: v + 1,
      totalMatchesAssigned: venueTotalMatches[v],
      endMinutesFromStart: venueLastEnd[v],
    });
  }

  let overallStatus: SimulationOverallStatus = "OK";
  let summaryMessage = `시뮬레이션 정상: 총 경기 ${totalMatches}건, 예상 소요 약 ${globalMin}분, 종료 ${globalEndAt.toISOString()}`;
  if (hasBlock) {
    overallStatus = "IMPOSSIBLE";
    summaryMessage = "생성 불가: 차단 조건이 있습니다. 검증 목록을 확인하세요.";
  } else if (hasWarn) {
    overallStatus = "WARNING";
    summaryMessage = "생성 가능(주의): 일부 운영 리스크가 있습니다.";
  }

  return {
    overallStatus,
    summaryMessage,
    validations,
    bracketSlotSize: S,
    byeCount,
    totalMatches,
    parallelCapacityEffective: Ceff,
    globalEndMinutesFromStart: globalMin,
    globalEndAt,
    venueFinishTimeSpreadMinutes: spread,
    venueSummaries,
    venueBatchDetails,
    roundWallMinutes,
  };
}
