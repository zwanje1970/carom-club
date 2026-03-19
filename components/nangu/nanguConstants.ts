/**
 * 난구 UI 공통 상수: 두께/당점 등에서 동일한 공 크기·스케일 사용.
 */

/** 공 지름 (mm) - 당점·두께 UI 동일 기준 */
export const BALL_DIAMETER_MM = 61.5;

/** 공 반지름 (mm) */
export const BALL_RADIUS_MM = BALL_DIAMETER_MM / 2;

/**
 * 당점 UI viewBox 기준 공 반지름(px).
 * NanguSpinEditor: SIZE=160 → 반지름 74 사용.
 * 두께 UI에서도 동일한 값으로 공을 그려 두 화면에서 같은 크기로 보이게 함.
 */
export const BALL_RADIUS_VIEWBOX_PX = 74;
