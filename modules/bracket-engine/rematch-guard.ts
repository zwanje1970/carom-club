/**
 * 같은 조 재대결 방지
 * 랜덤 배치 후 이전 라운드 같은 조 출신이 같은 조에 있으면 재배치
 */

import type { GroupAssignment, GroupSizes, ParticipantId, PreviousGroupInfo } from "./types";
import { randomGrouping } from "./random-grouping";

/**
 * 이전 라운드 조 정보 (participantId -> groupIndex)
 */
export function buildPreviousGroupMap(
  previousRoundAssignments: GroupAssignment,
  roundIndex: number
): Map<ParticipantId, { groupIndex: number; roundIndex: number }> {
  const map = new Map<ParticipantId, { groupIndex: number; roundIndex: number }>();
  previousRoundAssignments.forEach((group, groupIndex) => {
    group.forEach((pid) => {
      map.set(pid, { groupIndex, roundIndex });
    });
  });
  return map;
}

/**
 * 두 배정이 "같은 조 재대결"이 있는지 확인
 * assignment 내 같은 조에 있는 두 참가자가 prevMap에서도 같은 groupIndex를 가지면 충돌
 */
function hasRematch(
  assignment: GroupAssignment,
  prevMap: Map<ParticipantId, { groupIndex: number; roundIndex: number }>
): boolean {
  for (const group of assignment) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = prevMap.get(group[i]);
        const b = prevMap.get(group[j]);
        if (a && b && a.groupIndex === b.groupIndex) return true;
      }
    }
  }
  return false;
}

const MAX_RETRIES = 100;

/**
 * participantIds를 groupSizes로 배정하되, prevMap에 따른 이전 라운드 같은 조와 겹치지 않도록 재배치
 */
export function randomGroupingWithRematchGuard(
  participantIds: ParticipantId[],
  groupSizes: GroupSizes,
  prevMap: Map<ParticipantId, { groupIndex: number; roundIndex: number }>
): GroupAssignment {
  if (prevMap.size === 0) {
    return randomGrouping(participantIds, groupSizes);
  }
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const assignment = randomGrouping(participantIds, groupSizes);
    if (!hasRematch(assignment, prevMap)) return assignment;
  }
  // 재시도 후에도 실패하면 그냥 랜덤 결과 반환
  return randomGrouping(participantIds, groupSizes);
}
