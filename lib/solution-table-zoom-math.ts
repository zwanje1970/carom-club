/**
 * 해법 테이블 뷰 — 전체 캔버스 좌표계에 scale + translate 적용
 */

export const SOLUTION_ZOOM_MIN = 1;
export const SOLUTION_ZOOM_MAX = 4;
export const SOLUTION_ZOOM_STEP = 0.15;

export type SolutionTableFitMode = "contain" | "cover";

/**
 * 기준 맞춤 배율
 * - contain: 테이블 전체가 뷰포트 안에 들어감(여백 가능)
 * - cover: 테이블이 뷰포트를 덮음(잘림 가능, 여백 없음)
 */
export function computeFitScale(
  viewportW: number,
  viewportH: number,
  contentW: number,
  contentH: number,
  fitMode: SolutionTableFitMode = "contain"
): number {
  if (viewportW <= 0 || viewportH <= 0 || contentW <= 0 || contentH <= 0) return 1;
  const rw = viewportW / contentW;
  const rh = viewportH / contentH;
  return fitMode === "cover" ? Math.max(rw, rh) : Math.min(rw, rh);
}

export function clampZoomLevel(z: number): number {
  return Math.max(SOLUTION_ZOOM_MIN, Math.min(SOLUTION_ZOOM_MAX, z));
}

/**
 * transform-origin 0,0 기준:
 * 화면(뷰포트) 좌표 vx,vy → 콘텐츠(캔버스) 픽셀
 */
export function viewportPxToCanvasPx(
  vx: number,
  vy: number,
  translateX: number,
  translateY: number,
  scale: number
): { x: number; y: number } {
  const s = scale || 1;
  return {
    x: (vx - translateX) / s,
    y: (vy - translateY) / s,
  };
}

/**
 * 캔버스 포커스 (fx,fy)를 뷰포트 중심에 두도록 translate + 사용자 pan
 */
export function computeZoomTransform(params: {
  viewportW: number;
  viewportH: number;
  contentW: number;
  contentH: number;
  /** 사용자 확대 배율 (1 = 맞춤만) */
  zoomLevel: number;
  /** 캔버스 좌표계 기준 초점 */
  focusCanvasX: number;
  focusCanvasY: number;
  panX: number;
  panY: number;
  fitMode?: SolutionTableFitMode;
}): { scale: number; translateX: number; translateY: number; fitScale: number } {
  const {
    viewportW,
    viewportH,
    contentW,
    contentH,
    zoomLevel,
    focusCanvasX,
    focusCanvasY,
    panX,
    panY,
    fitMode = "contain",
  } = params;
  const fit = computeFitScale(viewportW, viewportH, contentW, contentH, fitMode);
  const z = clampZoomLevel(zoomLevel);
  const scale = fit * z;
  const translateX = viewportW / 2 + panX - scale * focusCanvasX;
  const translateY = viewportH / 2 + panY - scale * focusCanvasY;
  return { scale, translateX, translateY, fitScale: fit };
}

/** cover 모드: 스케일된 콘텐츠가 뷰포트를 항상 덮도록 허용되는 pan 범위 */
export function computePanClampBoundsForCover(params: {
  viewportW: number;
  viewportH: number;
  contentW: number;
  contentH: number;
  scale: number;
  focusCanvasX: number;
  focusCanvasY: number;
}): { minPanX: number; maxPanX: number; minPanY: number; maxPanY: number } {
  const {
    viewportW: vw,
    viewportH: vh,
    contentW: W,
    contentH: H,
    scale: s,
    focusCanvasX: fx,
    focusCanvasY: fy,
  } = params;
  const sW = s * W;
  const sH = s * H;
  let minPanX = s * fx + vw / 2 - sW;
  let maxPanX = s * fx - vw / 2;
  let minPanY = s * fy + vh / 2 - sH;
  let maxPanY = s * fy - vh / 2;
  if (minPanX > maxPanX) {
    const m = (minPanX + maxPanX) / 2;
    minPanX = maxPanX = m;
  }
  if (minPanY > maxPanY) {
    const m = (minPanY + maxPanY) / 2;
    minPanY = maxPanY = m;
  }
  return { minPanX, maxPanX, minPanY, maxPanY };
}

export function clampPanToCoverBounds(
  panX: number,
  panY: number,
  bounds: { minPanX: number; maxPanX: number; minPanY: number; maxPanY: number }
): { panX: number; panY: number } {
  return {
    panX: Math.min(bounds.maxPanX, Math.max(bounds.minPanX, panX)),
    panY: Math.min(bounds.maxPanY, Math.max(bounds.minPanY, panY)),
  };
}
