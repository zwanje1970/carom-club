/**
 * 진출 계산: 조별 순위/점수에서 N명 진출 목록 결정
 * (실제 점수 입력은 외부에서 주입, 여기서는 구조만)
 */

import type { ParticipantId } from "./types";

export type GroupStanding = {
  groupIndex: number;
  participantId: ParticipantId;
  rank: number;
  score?: number;
};

/**
 * 조별 순위에서 조당 advanceCount명 진출자 ID 배열 반환
 */
export function getAdvancementFromStandings(
  standings: GroupStanding[],
  advanceCount: number
): ParticipantId[] {
  const byGroup = new Map<number, GroupStanding[]>();
  for (const s of standings) {
    const list = byGroup.get(s.groupIndex) ?? [];
    list.push(s);
    byGroup.set(s.groupIndex, list);
  }
  const advanced: ParticipantId[] = [];
  for (const [, list] of byGroup) {
    const sorted = [...list].sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < advanceCount && i < sorted.length; i++) {
      advanced.push(sorted[i].participantId);
    }
  }
  return advanced;
}
