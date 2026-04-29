/**
 * 백업함 완전삭제 API 본문: `confirmText` 또는 기존 `deleteConfirm` 중 하나에 정확히 "DELETE".
 */
export function readPermanentDeleteConfirmText(body: Record<string, unknown>): string {
  const a = body.confirmText;
  const b = body.deleteConfirm;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof b === "string" && b.trim()) return b.trim();
  return "";
}
