/**
 * 예시 테스트: 23명, 6테이블, 최대 6명, 결승 3명, 1R 각 조 2명, 2R 각 조 1명
 * 기대: 1R = 4/4/4/4/4/3, 2R = 4/4/4, 결승 = 3명
 */

import { calculateGroupSizes, calculateGroupSizesWithTableLimit } from "../group-calculator";
import { generateRounds } from "../round-generator";

describe("bracket-engine example", () => {
  it("23명 조편성: 6조로 4/4/4/4/4/3", () => {
    const sizes = calculateGroupSizes(23, { minPerGroup: 3, maxPerGroup: 6, maxGroupSizeDiff: 1 });
    expect(sizes).toHaveLength(6);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(23);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
    expect(sizes.every((s) => s >= 3 && s <= 6)).toBe(true);
    const sorted = [...sizes].sort((a, b) => b - a);
    expect(sorted).toEqual([4, 4, 4, 4, 4, 3]);
  });

  it("23명 6테이블 제한: 성공하여 4/4/4/4/4/3", () => {
    const result = calculateGroupSizesWithTableLimit(23, {
      minPerGroup: 3,
      maxPerGroup: 6,
      maxGroupSizeDiff: 1,
      maxTables: 6,
    });
    expect(result.success).toBe(true);
    expect(result.groupSizes).toHaveLength(6);
    expect(result.groupSizes.reduce((a, b) => a + b, 0)).toBe(23);
    expect(result.groupSizes.sort((a, b) => b - a)).toEqual([4, 4, 4, 4, 4, 3]);
  });

  it("라운드 생성: 23명, 6테이블, 1R 2명 진출, 2R 1명 진출 → 1R 6조(4/4/4/4/4/3), 2R 3조(4/4/4), 결승 3명", () => {
    const plans = generateRounds({
      participantCount: 23,
      advancementPerRound: [2, 1],
      finalistCount: 3,
      tableCount: 6,
      constraints: { minPerGroup: 3, maxPerGroup: 6, maxGroupSizeDiff: 1 },
    });

    expect(plans).toHaveLength(2);

    expect(plans[0].roundIndex).toBe(0);
    expect(plans[0].participantCount).toBe(23);
    expect(plans[0].groupSizes).toHaveLength(6);
    expect(plans[0].groupSizes.reduce((a, b) => a + b, 0)).toBe(23);
    expect([...plans[0].groupSizes].sort((a, b) => b - a)).toEqual([4, 4, 4, 4, 4, 3]);
    expect(plans[0].advancePerGroup).toBe(2);

    expect(plans[1].roundIndex).toBe(1);
    expect(plans[1].participantCount).toBe(12);
    expect(plans[1].groupSizes).toHaveLength(3);
    expect(plans[1].groupSizes).toEqual([4, 4, 4]);
    expect(plans[1].advancePerGroup).toBe(1);

    expect(plans[1].groupSizes.length * plans[1].advancePerGroup).toBe(3);
  });
});
