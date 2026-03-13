/**
 * 랜덤 조편성: 참가자 ID 배열을 주어진 조 크기에 맞춰 무작위로 배치
 */

import type { GroupAssignment, GroupSizes, ParticipantId } from "./types";

/**
 * participantIds를 groupSizes에 맞춰 랜덤 셔플 후 배정
 */
export function randomGrouping(
  participantIds: ParticipantId[],
  groupSizes: GroupSizes
): GroupAssignment {
  const shuffled = [...participantIds].sort(() => Math.random() - 0.5);
  const result: GroupAssignment = [];
  let idx = 0;
  for (const size of groupSizes) {
    const group: ParticipantId[] = [];
    for (let i = 0; i < size && idx < shuffled.length; i++) {
      group.push(shuffled[idx++]);
    }
    result.push(group);
  }
  return result;
}
