/**
 * 난구 재생 — 두께(1~16/16)에 따른 충돌 순간 속도 분배 (요구 표)
 * L = hitSteps / 20 → 1목 전달 L, 수구 유지 (1-L)
 * 미니 아레나 겹침(step 작을수록 많이 겹침)과 맞추기 위해 물리 hitStep만 (1−t01) 기준으로 잡음.
 * `troubleHitStepFromThicknessOffsetX`는 패널·메인 슬라이더 동기화용으로 기존(t01) 유지.
 */
import { thickness01FromOffsetX } from "@/lib/thickness-power-split";

export function troubleHitStepFromThicknessOffsetX(thicknessOffsetX: number | undefined): number {
  if (thicknessOffsetX == null || Number.isNaN(thicknessOffsetX)) return 8;
  const t01 = thickness01FromOffsetX(thicknessOffsetX);
  return Math.max(1, Math.min(16, Math.round(1 + t01 * 15)));
}

function troublePhysicsHitStepFromThicknessOffsetX(thicknessOffsetX: number | undefined): number {
  if (thicknessOffsetX == null || Number.isNaN(thicknessOffsetX)) return 8;
  const t01 = thickness01FromOffsetX(thicknessOffsetX);
  return Math.max(1, Math.min(16, Math.round(1 + (1 - t01) * 15)));
}

export function computeTroubleThicknessSplit(
  isBankShot: boolean,
  thicknessOffsetX: number | undefined
): { thickness01: number; cueRetain: number; objectTransfer: number } {
  if (isBankShot) {
    return { thickness01: 0.5, cueRetain: 0.5, objectTransfer: 0.5 };
  }
  const step = troublePhysicsHitStepFromThicknessOffsetX(thicknessOffsetX);
  const L = step / 20;
  return { thickness01: step / 16, cueRetain: 1 - L, objectTransfer: L };
}

/**
 * 두께(1~16/16)에 따른 1목 전달 비율 L — `computeTroubleThicknessSplit`의 `objectTransfer`와 동일.
 * (겹침 표시 16/16 근처 → 높은 L, 0/16 근처 → 낮은 L)
 */
export function getThicknessLossRatio(
  isBankShot: boolean,
  thicknessOffsetX: number | undefined
): number {
  return computeTroubleThicknessSplit(isBankShot, thicknessOffsetX).objectTransfer;
}
