/** 정산 Firestore 모듈 전용 타입. */

export type SettlementExpenseItem = {
  id: string;
  title: string;
  amount: number;
};

export type SettlementLedgerLineStored = {
  id: string;
  category: string;
  flow: string;
  amountKrw: number;
  label: string | null;
  note: string | null;
  sortOrder: number;
  entryDate?: string | null;
};

export type TournamentSettlement = {
  tournamentId: string;
  refundedApplicationIds: string[];
  expenseItems: SettlementExpenseItem[];
  ledgerLines: SettlementLedgerLineStored[];
  isSettled: boolean;
  updatedAt: string;
};

export type TournamentSettlementSummary = {
  tournamentId: string;
  approvedCount: number;
  entryFee: number;
  totalDepositAmount: number;
  totalRefundAmount: number;
  netRevenue: number;
  totalExpenseAmount: number;
  finalProfit: number;
  isSettled: boolean;
};

export type TournamentSettlementEntryStatus =
  | "APPLIED"
  | "VERIFYING"
  | "WAITING_PAYMENT"
  | "APPROVED"
  | "REJECTED";

export type TournamentSettlementEntry = {
  applicationId: string;
  applicantName: string;
  phone: string;
  depositorName: string;
  status: TournamentSettlementEntryStatus;
  approvedAt: string;
  isRefunded: boolean;
};

/** 장부 GET API 응답의 tournament 필드 — 정산 화면용 최소값(id·대회명). */
export type SettlementLedgerTournamentSummary = {
  id: string;
  title: string;
};
