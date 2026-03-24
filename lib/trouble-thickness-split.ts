/**
 * 난구 재생 — 두께(1~16/16)에 따른 충돌 순간 속도 분배 (요구 표)
 * L = hitSteps / 20 → 1목 전달 L, 수구 유지 (1-L)
 * (16/16 → 80%, 1/16 → 5%)
 */
import { thickness01FromOffsetX } from "@/lib/thickness-power-split";

export function troubleHitStepFromThicknessOffsetX(thicknessOffsetX: number | undefined): number {
  if (thicknessOffsetX == null || Number.isNaN(thicknessOffsetX)) return 8;
  const t01 = thickness01FromOffsetX(thicknessOffsetX);
  return Math.max(1, Math.min(16, Math.round(1 + t01 * 15)));
}

export function computeTroubleThicknessSplit(
  isBankShot: boolean,
  thicknessOffsetX: number | undefined
): { thickness01: number; cueRetain: number; objectTransfer: number } {
  if (isBankShot) {
    return { thickness01: 0.5, cueRetain: 0.5, objectTransfer: 0.5 };
  }
  const step = troubleHitStepFromThicknessOffsetX(thicknessOffsetX);
  const L = step / 20;
  return { thickness01: step / 16, cueRetain: 1 - L, objectTransfer: L };
}

/**
 * 두께(1~16/16)에 따른 1목 전달 비율 L — `computeTroubleThicknessSplit`의 `objectTransfer`와 동일.
 * (16/16 → 80%, 8/16 → 40%, 1/16 → 5%)
 */
export function getThicknessLossRatio(
  isBankShot: boolean,
  thicknessOffsetX: number | undefined
): number {
  return computeTroubleThicknessSplit(isBankShot, thicknessOffsetX).objectTransfer;
}
