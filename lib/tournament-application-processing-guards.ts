/** 운영 승인(clientApplicationApprovedAt)이 있는데 입금 확인만 해제하려 할 때 */
export const DEPOSIT_UNCONFIRM_REQUIRES_APPROVAL_REVOKED_FIRST =
  "승인된 신청자는 먼저 승인을 해제한 뒤 입금을 해제할 수 있습니다.";

export function isProcessingApplicationApproved(clientApplicationApprovedAt: string | null | undefined): boolean {
  return typeof clientApplicationApprovedAt === "string" && clientApplicationApprovedAt.trim() !== "";
}
