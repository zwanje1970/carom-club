/**
 * SettingsPanel 미니 아레나와 동일한 규칙으로 수구 중심(정규화) 계산 — 실제 해법 화면 배치용.
 * 물리/재생 미사용.
 */
import type { CueSide, SolutionSettingsValue } from "@/lib/solution-settings-panel-value";
import { troubleHitStepFromThicknessOffsetX } from "@/lib/trouble-thickness-split";
import {
  getPlayfieldLongSide,
  getBallDiameter,
  normalizedToPixel,
  pixelToNormalized,
  clampBallToPlayfield,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";

/** SettingsPanel과 동일한 기준 공 지름(px) — 미니 아레나 */
export const PANEL_LAYOUT_REF_BALL_PX = 48;

/** 빨간 공 지름(D)의 1/16에 해당하는 두 중심 간격(ref px) — 미니 패널 수구 스텝 */
export const RED_BALL_GRID_DX_REF_PX = PANEL_LAYOUT_REF_BALL_PX / 16;

/**
 * ball-white.svg — 공 반지름 168.64, 가장 안쪽 가이드 원 32.91, 방사 가이드 최외곽 원 131.63(str4).
 * 당점 표시 원 반지름 = 안쪽 가이드와 동일(공 반지름 대비).
 */
const BALL_WHITE_SVG_BALL_R = 168.64;
const BALL_WHITE_GUIDE_INNER_R = 32.91;
const BALL_WHITE_GUIDE_OUTER_R = 131.63;

/** 당점 원 반지름 / 공 반지름 — 안쪽 가이드 원과 동일 */
export const CUE_TIP_MARK_RADIUS_FRAC = BALL_WHITE_GUIDE_INNER_R / BALL_WHITE_SVG_BALL_R;

/**
 * 당점 중심 최대 오프셋 / 공 반지름 — 당점 원 바깥 둘레가 최외곽 가이드 원 안에 들어가도록
 * (중심거리 + r_당점 ≤ R_최외곽).
 */
export const CUE_TIP_NORM_DISPLAY_FRAC =
  (BALL_WHITE_GUIDE_OUTER_R - BALL_WHITE_GUIDE_INNER_R) / BALL_WHITE_SVG_BALL_R;

/**
 * 빨간 공 지름(D)을 16등분 — 두 중심 간 거리 = (step/16)×D.
 * step=0 완전 겹침, step=16 원둘레 맞닿음(중심거리=D).
 * SettingsPanel 표시 `두께 n/16`은 `n = 16 - step`(16=완전 겹침, 0=완전 분리).
 */
export function centerDistPxForThicknessStep(step: number): number {
  const s = Math.max(0, Math.min(16, Math.round(step)));
  return (s / 16) * PANEL_LAYOUT_REF_BALL_PX;
}

/**
 * 미니 아레나·요약 바의 `n/16` 라벨 — **겹침 정도**만 표시 (물리 L과 무관).
 * `thicknessStep`과 `cueCenterOffsetPxFromRed`와 동일 소스.
 * - 16/16: 중심거리 0 → 최대 겹침
 * - 0/16: 중심거리 D → 맞닿음(프리뷰상 최대 분리)
 */
export function thicknessDisplayOverlapStep16(thicknessStep: number): number {
  const s = Math.max(0, Math.min(16, Math.round(thicknessStep)));
  return 16 - s;
}

/** 빨간 공 중심 기준 수구 중심 오프셋(미니 아레나 px) — SettingsPanel과 동일 */
export function cueCenterOffsetPxFromRed(
  thicknessStep: number,
  cueSide: CueSide,
  fineDx: number,
  fineDy: number
): { dx: number; dy: number } {
  const centerDist = centerDistPxForThicknessStep(thicknessStep);
  const base = cueSide === "left" ? -centerDist : centerDist;
  return { dx: base + fineDx, dy: fineDy };
}

/**
 * 미니 아레나에서 수구 중심이 화면 밖으로 나가지 않도록 layout dx 클램프(ref px).
 */
export function clampLayoutDxToMiniArena(
  dx: number,
  arenaW: number,
  ballDisplayPx: number,
  refBallDiameterPx: number
): number {
  const scale = ballDisplayPx / refBallDiameterPx;
  const redCenter = arenaW / 2;
  const ballR = ballDisplayPx / 2;
  const minDx = (ballR - redCenter) / scale;
  const maxDx = (arenaW - ballR - redCenter) / scale;
  return Math.max(minDx, Math.min(maxDx, dx));
}

/**
 * 빨간 공 기준 1/16~16/16 두께 + 좌우 조합의 **수평 dx**만 (미세 오프셋 없음).
 * 동일 dx(예: 16/16 완전 겹침)는 한 번만 등장.
 */
export function listDiscreteCueLayoutDx(): Array<{
  thicknessStep: number;
  cueSide: CueSide;
  dx: number;
}> {
  const seen = new Set<number>();
  const out: Array<{ thicknessStep: number; cueSide: CueSide; dx: number }> = [];
  for (let step = 0; step <= 16; step++) {
    for (const side of ["left", "right"] as const) {
      const dx = cueCenterOffsetPxFromRed(step, side, 0, 0).dx;
      if (seen.has(dx)) continue;
      seen.add(dx);
      out.push({ thicknessStep: step, cueSide: side, dx });
    }
  }
  out.sort((a, b) => a.dx - b.dx);
  return out;
}

export function discreteCueLayoutDxRange(): { min: number; max: number } {
  const list = listDiscreteCueLayoutDx();
  if (list.length === 0) return { min: 0, max: 0 };
  return { min: list[0].dx, max: list[list.length - 1].dx };
}

export function snapCueLayoutToDiscreteDx(targetDx: number): Pick<
  SolutionSettingsValue,
  "cueSide" | "thicknessStep" | "fineDx" | "fineDy"
> {
  let best: Pick<SolutionSettingsValue, "cueSide" | "thicknessStep" | "fineDx" | "fineDy"> = {
    cueSide: "left",
    thicknessStep: 16,
    fineDx: 0,
    fineDy: 0,
  };
  let bestErr = Infinity;
  for (let step = 0; step <= 16; step++) {
    for (const side of ["left", "right"] as const) {
      const dx = cueCenterOffsetPxFromRed(step, side, 0, 0).dx;
      const err = Math.abs(dx - targetDx);
      if (err < bestErr - 1e-9) {
        bestErr = err;
        best = { cueSide: side, thicknessStep: step, fineDx: 0, fineDy: 0 };
      }
    }
  }
  return best;
}

export function indexOfNearestDiscreteCueDx(
  currentDx: number,
  list: Array<{ dx: number; thicknessStep: number; cueSide: CueSide }>
): number {
  let bestI = 0;
  let bestErr = Infinity;
  for (let i = 0; i < list.length; i++) {
    const err = Math.abs(list[i].dx - currentDx);
    if (err < bestErr - 1e-9) {
      bestErr = err;
      bestI = i;
    }
  }
  return bestI;
}

/**
 * 빨간 공 정규화 좌표 + 패널 설정 → 수구가 있어야 할 정규화 좌표(landscape 0..1).
 * `rect`는 landscape 플레이필드 기준 `getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT)` 권장.
 */
export function computeCueBallNormFromPanelSettings(
  redNorm: { x: number; y: number },
  panel: Pick<SolutionSettingsValue, "cueSide" | "thicknessStep" | "fineDx" | "fineDy">,
  rect: PlayfieldRect
): { x: number; y: number } {
  const longSide = getPlayfieldLongSide(rect);
  const ballD = getBallDiameter(longSide);
  const scale = ballD / PANEL_LAYOUT_REF_BALL_PX;

  const { dx, dy } = cueCenterOffsetPxFromRed(
    panel.thicknessStep,
    panel.cueSide,
    panel.fineDx,
    panel.fineDy
  );
  const deltaX_pf = dx * scale;
  const deltaY_pf = dy * scale;

  const redPx = normalizedToPixel(redNorm.x, redNorm.y, rect);
  const cuePx = { px: redPx.px + deltaX_pf, py: redPx.py + deltaY_pf };
  const raw = pixelToNormalized(cuePx.px, cuePx.py, rect);
  return clampBallToPlayfield(raw.x, raw.y, rect);
}

/**
 * 메인 두께 슬라이더(thicknessOffsetX) → 미니 패널 두께·좌우 — 첫 패널 오픈 시 동기화용.
 * `troubleHitStepFromThicknessOffsetX`와 동일한 단계 체계.
 */
export function panelThicknessFromMainThicknessOffset(offsetX: number): Pick<
  SolutionSettingsValue,
  "thicknessStep" | "cueSide"
> {
  const o =
    offsetX == null || Number.isNaN(offsetX)
      ? 0.5
      : Math.max(0, Math.min(1, offsetX));
  const cueSide: CueSide = o <= 0.5 ? "left" : "right";
  const thicknessStep = troubleHitStepFromThicknessOffsetX(o);
  return { cueSide, thicknessStep };
}

/**
 * 미니 패널 두께(1=얇음 … 16=두꺼움, UI 간격과 동일 방향) → `thickness01FromOffsetX`·난구 단계와 맞는 offset.
 * `troubleHitStepFromThicknessOffsetX`의 역함수(정수 단계 기준).
 */
export function thicknessOffsetXFromThicknessStep(step: number, cueSide: CueSide): number {
  const s = Math.max(0, Math.min(16, Math.round(step)));
  const t01 = s / 16;
  return cueSide === "left" ? t01 / 2 : 1 - t01 / 2;
}
