/**
 * 공 **실제 색** 기준 스트로크 — "원래 위치" 링·편집 스팟 등.
 * 1목적구 **경로선** 파란색(`OBJECT_PATH_STROKE`)과 용도·값 분리.
 */
import type { BallColor } from "@/lib/billiard-table-constants";

export const BALL_POSITION_RING_RGB: Record<BallColor, { r: number; g: number; b: number }> = {
  red: { r: 196, g: 30, b: 58 },
  yellow: { r: 245, g: 208, b: 51 },
  white: { r: 248, g: 248, b: 248 },
};

/** SVG/Canvas 공통: 메인 링 색 (캔버스 공 fill 팔레트 `#c41e3a` 등과 정렬) */
export function getBallDisplayStrokeColor(ballKey: BallColor): string {
  const { r, g, b } = BALL_POSITION_RING_RGB[ballKey];
  return `rgb(${r},${g},${b})`;
}

export function getBallPositionRingStrokeRgba(ballKey: BallColor, alpha: number): string {
  const { r, g, b } = BALL_POSITION_RING_RGB[ballKey];
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 흰공: 배경과 구분용 바깥 테두리 (SVG 이중 stroke / 캔버스 먼저 그리는 외곽선) */
export function getBallPositionRingOutlineColorCss(ballKey: BallColor): string | null {
  return ballKey === "white" ? "rgba(0,0,0,0.52)" : null;
}
