/**
 * v2 정산(라인 장부) 기준 타입·합산.
 */

export const SETTLEMENT_CATEGORIES = [
  "ENTRY_FEE",
  "REFUND",
  "PRIZE",
  "OPERATING",
  "VENUE_RENT",
  "LABOR",
  "OTHER",
] as const;

export type SettlementCategoryV2 = (typeof SETTLEMENT_CATEGORIES)[number];

export const SETTLEMENT_CATEGORY_LABEL: Record<SettlementCategoryV2, string> = {
  ENTRY_FEE: "참가비",
  REFUND: "환불",
  PRIZE: "상금",
  OPERATING: "운영비",
  VENUE_RENT: "대관료",
  LABOR: "인건비",
  OTHER: "기타",
};

export const SETTLEMENT_FLOW = ["INCOME", "EXPENSE"] as const;
export type SettlementFlowV2 = (typeof SETTLEMENT_FLOW)[number];

export function isSettlementCategoryV2(s: string): s is SettlementCategoryV2 {
  return (SETTLEMENT_CATEGORIES as readonly string[]).includes(s);
}

export function isSettlementFlowV2(s: string): s is SettlementFlowV2 {
  return s === "INCOME" || s === "EXPENSE";
}

export type SettlementLedgerLineV2 = {
  category: SettlementCategoryV2;
  flow: SettlementFlowV2;
  /** 원 단위, 0 이상 */
  amountKrw: number;
  label?: string | null;
  note?: string | null;
  sortOrder?: number;
};

export function computeLedgerTotalsFromLines(lines: { flow: string; amountKrw: number }[]): {
  income: number;
  expense: number;
  net: number;
} {
  let income = 0;
  let expense = 0;
  for (const row of lines) {
    const n = Math.abs(Number(row.amountKrw) || 0);
    if (row.flow === "INCOME") income += n;
    else expense += n;
  }
  return { income, expense, net: income - expense };
}
