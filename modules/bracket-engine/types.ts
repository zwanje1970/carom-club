/** 조 편성 결과: 조별 인원 수 배열 (예: [4,4,4,4,4,3]) */
export type GroupSizes = number[];

/** 라운드 정의 */
export type RoundPlan = {
  roundIndex: number;
  participantCount: number;
  groupSizes: GroupSizes;
  advancePerGroup: number; // 이 라운드에서 조당 진출 인원
};

/** 조편성 제약 */
export type GroupingConstraints = {
  minPerGroup: number;
  maxPerGroup: number;
  maxGroupSizeDiff: number;
  maxTables?: number;
};

/** 조편성 결과 (테이블 수 반영) */
export type GroupingResult = {
  success: boolean;
  groupSizes: GroupSizes;
  recommendedTableCount?: number; // 불가 시 추천 테이블 수
  message?: string;
};

/** 참가자 ID (엔트리 또는 유저 식별자) */
export type ParticipantId = string;

/** 이전 라운드 조 정보 (재대결 방지용) */
export type PreviousGroupInfo = {
  participantId: ParticipantId;
  groupIndex: number;
  roundIndex: number;
};

/** 조별 참가자 배정 (participantId[]) */
export type GroupAssignment = ParticipantId[][];

/** 세션 배정: 세션 번호 → 해당 세션에 배정된 조 인덱스들 */
export type SessionPlan = {
  sessionCount: number;
  tableCount: number;
  groupCount: number;
  sessions: number[][]; // sessions[sessionIndex] = [groupIndex, ...]
};

/** 토너먼트 브래킷 매치 (1대1 등) */
export type BracketMatch = {
  matchIndex: number;
  roundIndex: number;
  slotIndex: number;
  participantIds: ParticipantId[]; // [a, b] for 1v1, [a,b,c,d] for 2v2
  winnerId?: ParticipantId;
};
