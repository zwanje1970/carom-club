/**
 * 라운드 생성기
 * 현재 라운드 참가자 수와 조별 진출 인원으로 다음 라운드 참가자 수를 계산하고 결승 인원까지 반복 생성.
 */

import { calculateGroupSizes, calculateGroupSizesWithTableLimit } from "./group-calculator";
import type { GroupingConstraints, RoundPlan } from "./types";

export type RoundGeneratorInput = {
  participantCount: number;
  advancementPerRound: number[]; // [1R 진출 수, 2R 진출 수, ...]
  finalistCount: number;
  tableCount?: number;
  constraints?: Partial<GroupingConstraints>;
};

/**
 * 라운드별 조 편성 계획 생성
 * advancementPerRound[i] = i번째 라운드에서 조당 진출 인원
 * 마지막 라운드 직전까지 advancement 적용, 마지막은 finalistCount명으로 결승
 */
export function generateRounds(input: RoundGeneratorInput): RoundPlan[] {
  const {
    participantCount,
    advancementPerRound,
    tableCount,
    constraints = {},
  } = input;

  const plans: RoundPlan[] = [];
  let currentCount = participantCount;

  for (let r = 0; r < advancementPerRound.length; r++) {
    const advance = advancementPerRound[r];
    const result = tableCount != null
      ? calculateGroupSizesWithTableLimit(currentCount, { ...constraints, maxTables: tableCount })
      : { success: true, groupSizes: calculateGroupSizes(currentCount, constraints) };

    if (!result.success) break;
    const groupSizes = result.groupSizes;
    if (groupSizes.length === 0) break;

    plans.push({
      roundIndex: r,
      participantCount: currentCount,
      groupSizes,
      advancePerGroup: advance,
    });

    currentCount = groupSizes.length * advance;
    if (currentCount <= 0) break;
  }

  return plans;
}
