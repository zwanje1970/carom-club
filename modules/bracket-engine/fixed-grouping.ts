/**
 * 고정 조편성: 참가자 순서를 유지한 채 조 크기대로 순차 배치
 * (예: 1조 1~4번, 2조 5~8번)
 */

import type { GroupAssignment, GroupSizes, ParticipantId } from "./types";

/**
 * participantIds를 groupSizes에 맞춰 순서대로 배정
 */
export function fixedGrouping(
  participantIds: ParticipantId[],
  groupSizes: GroupSizes
): GroupAssignment {
  const result: GroupAssignment = [];
  let idx = 0;
  for (const size of groupSizes) {
    const group: ParticipantId[] = [];
    for (let i = 0; i < size && idx < participantIds.length; i++) {
      group.push(participantIds[idx++]);
    }
    result.push(group);
  }
  return result;
}
