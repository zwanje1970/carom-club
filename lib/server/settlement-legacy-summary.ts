/**
 * 구 v3 자동 정산 요약: 승인 인원×참가비 − 환불 − 지출 항목.
 * API 응답 호환을 위해 유지하며, dev-store에서만 호출한다.
 */

export function computeLegacyAutoSettlementSummary(params: {
  tournamentId: string;
  entryFee: number;
  approvedApplicationIds: string[];
  refundedApplicationIds: string[];
  expenseAmounts: number[];
  isSettled: boolean;
}): {
  tournamentId: string;
  approvedCount: number;
  entryFee: number;
  totalDepositAmount: number;
  totalRefundAmount: number;
  netRevenue: number;
  totalExpenseAmount: number;
  finalProfit: number;
  isSettled: boolean;
} {
  const approvedCount = params.approvedApplicationIds.length;
  const entryFee = params.entryFee;
  const totalDepositAmount = approvedCount * entryFee;
  const approvedIdSet = new Set(params.approvedApplicationIds);
  const refundedApprovedCount = params.refundedApplicationIds.filter((id) => approvedIdSet.has(id)).length;
  const totalRefundAmount = refundedApprovedCount * entryFee;
  const netRevenue = totalDepositAmount - totalRefundAmount;
  const totalExpenseAmount = params.expenseAmounts.reduce((sum, n) => sum + n, 0);
  const finalProfit = netRevenue - totalExpenseAmount;

  return {
    tournamentId: params.tournamentId,
    approvedCount,
    entryFee,
    totalDepositAmount,
    totalRefundAmount,
    netRevenue,
    totalExpenseAmount,
    finalProfit,
    isSettled: params.isSettled,
  };
}
