/**
 * AVG 증빙 상태 판별 (서버/클라이언트 공용 순수 로직)
 */

const EXPIRING_DAYS = 30;

export type AvgProofStatusType = "valid" | "expiring_soon" | "expired" | "none";

export function getAvgProofStatus(
  avgProofUrl: string | null | undefined,
  avgProofExpiresAt: Date | string | null | undefined
): AvgProofStatusType {
  if (!avgProofUrl) return "none";
  if (!avgProofExpiresAt) return "valid";
  const exp = new Date(avgProofExpiresAt);
  const now = new Date();
  if (exp < now) return "expired";
  const daysLeft = (exp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);
  if (daysLeft <= EXPIRING_DAYS) return "expiring_soon";
  return "valid";
}
