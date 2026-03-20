/**
 * 두께(충돌) — totalPower를 수구 유지계수·1목 전달계수로 분배
 *
 * cuePower = totalPower * cueRetain(thickness)
 * objectPower = totalPower * objectTransfer(thickness)
 * cueRetain + objectTransfer === 1
 *
 * thickness ↑ → objectTransfer ↑, cueRetain ↓
 * thickness ↓ → cueRetain ↑, objectTransfer ↓
 */

/** 에디터 thicknessOffsetX(0..1): 0.5에 가까울수록 두꺼운 충돌 */
export function thickness01FromOffsetX(thicknessOffsetX: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(thicknessOffsetX - 0.5) * 2));
}

/**
 * 수치 두께 예: 4/16 = 0.25
 * hitSteps가 클수록(전체에 가까울수록) 두꺼운 충돌로 간주
 */
export function thickness01FromSixteenths(hitSteps: number, totalSteps = 16): number {
  if (totalSteps <= 0) return 0.5;
  return Math.max(0, Math.min(1, hitSteps / totalSteps));
}

export interface ThicknessCollisionSplit {
  /** 0=얇음, 1=두꺼움 (내부 정규화) */
  thickness01: number;
  /** totalPower 대비 수구 쪽 분배 */
  cueRetain: number;
  /** totalPower 대비 1목적구 쪽 분배 */
  objectTransfer: number;
}

/** 1목 전달 비율 범위 (얇을 때 최소, 두꺼울 때 최대) */
const OBJECT_TRANSFER_MIN = 0.1;
const OBJECT_TRANSFER_MAX = 0.9;

/**
 * thickness01에 따른 유지/전달 계수 (선형 보간)
 */
export function computeCollisionPowerSplit(thickness01: number): Pick<ThicknessCollisionSplit, "cueRetain" | "objectTransfer"> {
  const t = Math.max(0, Math.min(1, thickness01));
  const objectTransfer = OBJECT_TRANSFER_MIN + (OBJECT_TRANSFER_MAX - OBJECT_TRANSFER_MIN) * t;
  const cueRetain = 1 - objectTransfer;
  return { cueRetain, objectTransfer };
}

export function computeThicknessCollisionSplitFromSolution(
  isBankShot: boolean,
  thicknessOffsetX?: number
): ThicknessCollisionSplit {
  if (isBankShot) {
    return { thickness01: 0.5, cueRetain: 0.5, objectTransfer: 0.5 };
  }
  if (thicknessOffsetX == null || Number.isNaN(thicknessOffsetX)) {
    const { cueRetain, objectTransfer } = computeCollisionPowerSplit(0.5);
    return { thickness01: 0.5, cueRetain, objectTransfer };
  }
  const thickness01 = thickness01FromOffsetX(thicknessOffsetX);
  const { cueRetain, objectTransfer } = computeCollisionPowerSplit(thickness01);
  return { thickness01, cueRetain, objectTransfer };
}

/**
 * 동일 가속·시간 스케일 가정 시 상대 재생 시간 비율(거리 비율과 동일)
 */
export function relativeDurationShareCue(split: Pick<ThicknessCollisionSplit, "cueRetain" | "objectTransfer">): number {
  return split.cueRetain;
}

export function relativeDurationShareObject(split: Pick<ThicknessCollisionSplit, "cueRetain" | "objectTransfer">): number {
  return split.objectTransfer;
}
