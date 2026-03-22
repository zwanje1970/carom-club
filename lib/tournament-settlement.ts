export const SETTLEMENT_CATEGORIES = [
  "ENTRY_FEE",
  "REFUND",
  "PRIZE",
  "OPERATING",
  "VENUE_RENT",
  "LABOR",
  "OTHER",
] as const;

export type SettlementCategory = (typeof SETTLEMENT_CATEGORIES)[number];

export const SETTLEMENT_CATEGORY_LABEL: Record<SettlementCategory, string> = {
  ENTRY_FEE: "참가비",
  REFUND: "환불",
  PRIZE: "상금",
  OPERATING: "운영비",
  VENUE_RENT: "대관료",
  LABOR: "인건비",
  OTHER: "기타",
};

export const SETTLEMENT_FLOW = ["INCOME", "EXPENSE"] as const;
export type SettlementFlow = (typeof SETTLEMENT_FLOW)[number];

export function isSettlementCategory(s: string): s is SettlementCategory {
  return (SETTLEMENT_CATEGORIES as readonly string[]).includes(s);
}

export function isSettlementFlow(s: string): s is SettlementFlow {
  return s === "INCOME" || s === "EXPENSE";
}

export function computeSettlementTotals(lines: { flow: string; amountKrw: number }[]): {
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
