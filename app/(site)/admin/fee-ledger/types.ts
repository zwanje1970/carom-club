/** 한 행: 업체별 회비 장부 요약. slug는 DB nullable이지만 UI 전달 시 normalize로 string. */
export type FeeLedgerRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  feeType: string | null;
  amountInWon: number | null;
  latestPeriod: string | null;
  latestPaidAt: string | null;
  thisMonthStatus: "납부완료" | "미납" | "해당없음";
  monthsArrears: number | null;
  totalPaid: number;
  adminRemarks: string | null;
};

/** 입금 1건 (전체 목록용) */
export type PaymentRecord = {
  id: string;
  organizationId: string;
  organizationName: string;
  amountInWon: number;
  paidAt: string;
  period: string;
  memo: string | null;
};

export type FeeLedgerData = {
  rows: FeeLedgerRow[];
  payments: PaymentRecord[];
  summary: {
    totalOrgs: number;
    paidThisMonth: number;
    arrearsCount: number;
    totalAmount: number;
  };
};
