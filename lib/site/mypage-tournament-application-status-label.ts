/**
 * 마이페이지 대회 신청 진행상태 표시(클라이언트·서버 공통, DB 구조 변경 없음).
 */

export type MypageApplicationStatusLabelInput = {
  status: string;
  clientDepositConfirmedAt?: string | null;
  clientApplicationApprovedAt?: string | null;
  processingApprovalCanceledNotifiedAt?: string | null;
};

function hasNonEmptyString(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * @param options.history — 지난 기록 목록이면 `APPROVED` 잔여 표기에 "참가 완료" 사용
 */
export function getMypageTournamentApplicationStatusLabel(
  input: MypageApplicationStatusLabelInput,
  options?: { history?: boolean }
): string {
  const st = input.status;
  const dep = hasNonEmptyString(input.clientDepositConfirmedAt);
  const app = hasNonEmptyString(input.clientApplicationApprovedAt);
  const pacn = hasNonEmptyString(input.processingApprovalCanceledNotifiedAt);

  if (st === "REJECTED") return "참가 불가";
  if (pacn) return "신청취소";
  if (dep && app) return "신청완료";
  if (st === "APPROVED") return options?.history ? "참가 완료" : "참가 확정";
  if (dep && !app) return "입금확인";
  if (st === "APPLIED") return "신청접수";
  if (st === "VERIFYING") return "검증 진행중";
  if (st === "WAITING_PAYMENT") return "입금 필요";
  if (st === "WAITING") return "대기자";
  return options?.history ? "신청접수" : "진행중";
}
