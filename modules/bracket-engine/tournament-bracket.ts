/**
 * 토너먼트 브래킷 생성
 * 1대1 마스터즈, 1대1 부별, 2대2 스카치 지원
 */

import type { BracketMatch, ParticipantId } from "./types";

export type BracketFormat = "1v1_masters" | "1v1_division" | "2v2_scotch";

/**
 * 싱글 엘리미네이션 1대1: 2의 거듭제곱 슬롯, 부전승 허용. 1라운드 매치만 생성 (승자 진출은 진행에 따라 채움)
 */
export function build1v1Bracket(participantIds: ParticipantId[]): BracketMatch[] {
  const n = participantIds.length;
  if (n <= 1) return [];

  let size = 1;
  while (size < n) size *= 2;
  const byes = size - n;

  const slots: (ParticipantId | null)[] = [...participantIds];
  for (let i = 0; i < byes; i++) slots.push(null);

  const matches: BracketMatch[] = [];
  const roundSize = size / 2;
  for (let i = 0; i < roundSize; i++) {
    const a = slots[i * 2] ?? null;
    const b = slots[i * 2 + 1] ?? null;
    const ids: ParticipantId[] = [];
    if (a) ids.push(a);
    if (b) ids.push(b);
    matches.push({
      matchIndex: i,
      roundIndex: 0,
      slotIndex: i,
      participantIds: ids,
    });
  }
  return matches;
}

/**
 * 2대2 스카치: 4명이 한 매치 (팀A 2명 vs 팀B 2명)
 * 참가자 수는 4의 배수가 이상적; 부전승/재편성 정책은 단순화
 */
export function build2v2ScotchBracket(participantIds: ParticipantId[]): BracketMatch[] {
  const n = participantIds.length;
  if (n < 4) return [];

  const teamCount = Math.floor(n / 2); // 2명씩 팀
  let bracketSize = 1;
  while (bracketSize < teamCount) bracketSize *= 2;

  const matches: BracketMatch[] = [];
  let matchIndex = 0;
  let idx = 0;
  for (let r = 0; r < Math.ceil(Math.log2(bracketSize)) + 1; r++) {
    const matchesInRound = Math.floor(bracketSize / Math.pow(2, r));
    for (let s = 0; s < matchesInRound; s++) {
      const a1 = participantIds[idx++] ?? null;
      const a2 = participantIds[idx++] ?? null;
      const b1 = participantIds[idx++] ?? null;
      const b2 = participantIds[idx++] ?? null;
      const ids: ParticipantId[] = [a1, a2, b1, b2].filter((x): x is ParticipantId => x != null);
      if (ids.length >= 2) {
        matches.push({
          matchIndex: matchIndex++,
          roundIndex: r,
          slotIndex: s,
          participantIds: ids,
        });
      }
    }
  }
  return matches;
}

/**
 * 포맷에 따라 브래킷 생성
 */
export function buildBracket(
  format: BracketFormat,
  participantIds: ParticipantId[]
): BracketMatch[] {
  switch (format) {
    case "1v1_masters":
    case "1v1_division":
      return build1v1Bracket(participantIds);
    case "2v2_scotch":
      return build2v2ScotchBracket(participantIds);
    default:
      return build1v1Bracket(participantIds);
  }
}
