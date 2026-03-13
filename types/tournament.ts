// 대회 상태: Prisma TournamentStatus enum 기준
export const TOURNAMENT_STATUSES = [
  { value: "DRAFT", label: "초안" },
  { value: "OPEN", label: "모집중" },
  { value: "CLOSED", label: "마감" },
  { value: "FINISHED", label: "종료" },
  { value: "HIDDEN", label: "숨김" },
] as const;

export type TournamentStatusValue = (typeof TOURNAMENT_STATUSES)[number]["value"];

// 참가 신청 상태: Prisma TournamentEntryStatus enum 기준
export const ENTRY_STATUSES = [
  { value: "APPLIED", label: "신청됨" },
  { value: "CONFIRMED", label: "참가 확정" },
  { value: "REJECTED", label: "거절" },
  { value: "CANCELED", label: "취소" },
] as const;

export type EntryStatusValue = (typeof ENTRY_STATUSES)[number]["value"];

// 경기 방식: 캐롬, 서바이벌, 토너먼트
export const GAME_FORMAT_MAIN = [
  { value: "carom", label: "캐롬" },
  { value: "jukbang", label: "캐롬(구)" },
  { value: "survival", label: "서바이벌" },
  { value: "tournament", label: "토너먼트" },
] as const;

// 토너먼트 세부 방식
export const TOURNAMENT_DETAIL_FORMATS = [
  { value: "1v1_masters", label: "1대1 마스터즈" },
  { value: "1v1_division", label: "1대1 부별" },
  { value: "2v2_scotch", label: "2대2 스카치" },
] as const;

// 상금 방식
export const PRIZE_TYPES = [
  { value: "fixed", label: "고정 상금" },
  { value: "ratio", label: "변동 상금(비율 배분)" },
  { value: "score_proportional", label: "변동 상금(점수 비례 배분)" },
] as const;

export type BracketConfig = {
  tableCount?: number;
  maxPerGroup?: number;
  finalistCount?: number;
  noRematch?: boolean;
  detailFormat?: string;
};

export type PrizeFixedRank = { rank: number; amount: number };
export type PrizeFixedInfo = { ranks: PrizeFixedRank[] };

export type PrizeRatioRank = { rank: number; percent: number };
export type PrizeRatioInfo = {
  entryFee: number;
  operatingFee: number;
  ranks: PrizeRatioRank[];
};

export type PrizeScoreInfo = Record<string, unknown>; // 점수 비례 설정
