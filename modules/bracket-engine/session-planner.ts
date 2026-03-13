/**
 * 세션 배정기
 * 조 수와 테이블 수를 받아 세션별로 어떤 조를 배정할지 계산
 */

import type { SessionPlan } from "./types";

/**
 * groupCount개 조를 tableCount개 테이블로 운영할 때 세션별 배정
 * 한 세션에 최대 tableCount개 조가 동시에 진행
 */
export function planSessions(groupCount: number, tableCount: number): SessionPlan {
  const sessionCount = Math.ceil(groupCount / tableCount);
  const sessions: number[][] = [];
  for (let s = 0; s < sessionCount; s++) {
    const groups: number[] = [];
    for (let t = 0; t < tableCount; t++) {
      const groupIndex = s * tableCount + t;
      if (groupIndex < groupCount) groups.push(groupIndex);
    }
    sessions.push(groups);
  }
  return {
    sessionCount,
    tableCount,
    groupCount,
    sessions,
  };
}
