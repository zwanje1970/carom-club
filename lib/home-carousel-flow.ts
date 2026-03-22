/** 메인 대회·당구장 가로 흐름 속도 (관리자 1~100) → 초당 픽셀 */
export function clampFlowSpeed(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.floor(n) : 50;
  return Math.max(1, Math.min(100, v));
}

export function flowSpeedToPxPerSec(flowSpeed: number): number {
  const s = clampFlowSpeed(flowSpeed);
  return 5 + (s / 100) * 95;
}
