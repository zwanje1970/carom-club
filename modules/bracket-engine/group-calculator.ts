/**
 * 캐롬/서바이벌 조편성 계산기
 * 조건: 최소 3명, 최대 6명, 조 인원 차이 1 이하, 가능한 한 조 수를 늘리고 3명/4명 조 우선
 */

import type { GroupingConstraints, GroupingResult, GroupSizes } from "./types";

const DEFAULT_CONSTRAINTS: GroupingConstraints = {
  minPerGroup: 3,
  maxPerGroup: 6,
  maxGroupSizeDiff: 1,
};

/**
 * N명을 조로 나눌 때 조별 인원 배열을 계산한다.
 * - 조 수를 최대화 (조당 인원을 최소화하되 min 이상)
 * - 3명/4명 조 우선 (5,6은 차선)
 * - 조 간 인원 차이는 1 이하
 */
export function calculateGroupSizes(
  participantCount: number,
  constraints: Partial<GroupingConstraints> = {}
): GroupSizes {
  const { minPerGroup, maxPerGroup, maxGroupSizeDiff } = {
    ...DEFAULT_CONSTRAINTS,
    ...constraints,
  };

  if (participantCount < minPerGroup) {
    return participantCount > 0 ? [participantCount] : [];
  }

  // 조 수의 상한: 전원 최소 인원일 때
  const maxGroups = Math.floor(participantCount / minPerGroup);
  // 조 수의 하한: 전원 최대 인원일 때
  const minGroups = Math.ceil(participantCount / maxPerGroup);

  // 가능한 조 수 후보 (minGroups ~ maxGroups) 중에서
  // 3명/4명 조 우선: 4명 조 개수 > 3명 조 개수 순으로 선호
  let best: GroupSizes = [];
  let bestScore = -1;
  for (let g = minGroups; g <= maxGroups; g++) {
    const sizes = fillGroupSizes(participantCount, g, minPerGroup, maxPerGroup, maxGroupSizeDiff);
    if (sizes.length === 0) continue;
    const count4 = sizes.filter((s) => s === 4).length;
    const count3 = sizes.filter((s) => s === 3).length;
    const score = count4 * 10 + count3;
    if (score > bestScore) {
      bestScore = score;
      best = sizes;
    }
  }
  if (best.length > 0) return best;

  // 불가능하면 단일 조 (인원 초과여도 반환)
  return [participantCount];
}

function fillGroupSizes(
  total: number,
  groupCount: number,
  minP: number,
  maxP: number,
  maxDiff: number
): GroupSizes {
  const base = Math.floor(total / groupCount);
  const remainder = total % groupCount;
  const sizes: number[] = [];
  for (let i = 0; i < groupCount; i++) {
    const size = base + (i < remainder ? 1 : 0);
    if (size < minP || size > maxP) return [];
    sizes.push(size);
  }
  const minSize = Math.min(...sizes);
  const maxSize = Math.max(...sizes);
  if (maxSize - minSize > maxDiff) return [];
  return sizes;
}

/**
 * 지정 테이블 수(maxTables) 반영: 조 수가 테이블 수 이하여야 함.
 * 불가능하면 success: false 및 추천 테이블 수 반환.
 */
export function calculateGroupSizesWithTableLimit(
  participantCount: number,
  constraints: Partial<GroupingConstraints> & { maxTables: number }
): GroupingResult {
  const { maxTables, ...rest } = constraints;
  const withoutLimit = calculateGroupSizes(participantCount, rest);
  const groupCount = withoutLimit.length;

  if (groupCount <= maxTables) {
    return { success: true, groupSizes: withoutLimit };
  }

  // 테이블 수 제한 안에서 가능한 조편성: 1..maxTables 조 중 3/4명 조 우선
  const fullConstraints: GroupingConstraints = { ...DEFAULT_CONSTRAINTS, ...rest };
  const forced = tryFitToMaxGroups(participantCount, maxTables, fullConstraints);
  if (forced.length > 0) {
    return { success: true, groupSizes: forced };
  }

  return {
    success: false,
    groupSizes: withoutLimit,
    recommendedTableCount: groupCount,
    message: `참가 인원(${participantCount}명)을 편성하려면 최소 ${groupCount}개 테이블이 필요합니다.`,
  };
}

function tryFitToMaxGroups(
  total: number,
  maxTables: number,
  c: GroupingConstraints
): GroupSizes {
  const { minPerGroup, maxPerGroup, maxGroupSizeDiff } = c;
  const minGroups = Math.ceil(total / maxPerGroup);
  let best: GroupSizes = [];
  let bestScore = -1;
  for (let g = minGroups; g <= maxTables; g++) {
    if (g * minPerGroup > total || g * maxPerGroup < total) continue;
    const sizes = fillGroupSizes(total, g, minPerGroup, maxPerGroup, maxGroupSizeDiff);
    if (sizes.length === 0) continue;
    const count4 = sizes.filter((s) => s === 4).length;
    const count3 = sizes.filter((s) => s === 3).length;
    const score = count4 * 10 + count3;
    if (score > bestScore) {
      bestScore = score;
      best = sizes;
    }
  }
  return best;
}
