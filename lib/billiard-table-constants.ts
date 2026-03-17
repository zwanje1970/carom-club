/**
 * 당구대·공 규격 (2:1 테이블, 공 61.5mm)
 * 좌표는 플레이필드 기준 0..1 정규화 (저장/복원용)
 */

/** 테이블 필드(플레이필드) 비율: 가로(긴쪽) : 세로(짧은쪽) = 2 : 1. 항상 유지 */
export const TABLE_RATIO = 2;

/** 플레이필드 긴쪽(가로) 픽셀. 변경 금지 — 공 배치·좌표계·저장 기준 */
export const PLAYFIELD_WIDTH = 712;

/** 플레이필드 짧은쪽(세로) = 긴쪽 / 2. 비율 2:1 유지 */
export const PLAYFIELD_HEIGHT = PLAYFIELD_WIDTH / TABLE_RATIO;

/** 프레임 두께 (픽셀). 바깥쪽. 기존 21 → 10% 확대 23. 캔버스 가장자리에서 쿠션필드 바깥 경계까지 */
export const FRAME_INSET = 23;

/** 쿠션필드 두께 (픽셀). 프레임 안쪽에서 플레이필드까지. 기존 11 → 10% 축소 10 */
export const CUSHION_INSET = 10;

/** 총 여백 (프레임 + 쿠션). 플레이필드 크기는 위 상수 유지 */
const INSET_TOTAL = FRAME_INSET + CUSHION_INSET;

/** 레일+쿠션 두께 (픽셀). 테이블 가장자리에서 플레이필드까지 */
export const PLAYFIELD_INSET = INSET_TOTAL;

/** 캔버스 기본 크기 = 플레이필드 원래 크기 + 좌우/상하 여백 */
export const DEFAULT_TABLE_WIDTH = PLAYFIELD_WIDTH + INSET_TOTAL * 2;
export const DEFAULT_TABLE_HEIGHT = PLAYFIELD_HEIGHT + INSET_TOTAL * 2;

/**
 * 공 지름은 플레이필드 긴 변(longSide) 기준 약 2.16%.
 * 화면/orientation 기준 아님. 테이블 회전 시에도 공 크기 동일 유지.
 * longSide = max(playFieldWidth, playFieldHeight)
 * ballDiameter = longSide * BALL_DIAMETER_RATIO
 */
export const BALL_DIAMETER_RATIO = 0.0216;

/** 플레이필드 긴 변(px) = max(width, height). 공 크기 계산에만 사용. */
export function getPlayfieldLongSide(rect: PlayfieldRect): number {
  return Math.max(rect.width, rect.height);
}

/** 플레이필드 긴 변(px) 기준 공 지름(px). 화면/orientation 사용 금지. */
export function getBallDiameter(playFieldLongSide: number): number {
  return playFieldLongSide * BALL_DIAMETER_RATIO;
}

/** 플레이필드 긴 변(px) 기준 공 반지름(px). ballRadius = ballDiameter / 2 */
export function getBallRadius(playFieldLongSide: number): number {
  return getBallDiameter(playFieldLongSide) / 2;
}

export type BallColor = "red" | "yellow" | "white";
export type CueBallType = "white" | "yellow";

/** 가로형 = 캔버스 가로가 길고, 세로형 = 캔버스 세로가 긺. 좌표는 항상 landscape 기준 0..1 저장 */
export type TableOrientation = "landscape" | "portrait";

/**
 * landscape 정규화 (x,y) → portrait 화면용 정규화.
 * 테이블을 90° 시계방향 회전했을 때 같은 상대 위치.
 */
export function landscapeToPortraitNorm(x: number, y: number): { x: number; y: number } {
  return { x: 1 - y, y: x };
}

/**
 * portrait 화면 정규화 (x',y') → landscape 저장용 정규화.
 */
export function portraitToLandscapeNorm(x: number, y: number): { x: number; y: number } {
  return { x: y, y: 1 - x };
}

export interface PlayfieldRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getPlayfieldRect(
  tableWidth: number = DEFAULT_TABLE_WIDTH,
  tableHeight: number = DEFAULT_TABLE_HEIGHT
): PlayfieldRect {
  return {
    left: PLAYFIELD_INSET,
    top: PLAYFIELD_INSET,
    width: tableWidth - PLAYFIELD_INSET * 2,
    height: tableHeight - PLAYFIELD_INSET * 2,
  };
}

/** 픽셀 좌표 → 정규화 0..1 (플레이필드 내) */
export function pixelToNormalized(
  px: number,
  py: number,
  rect: PlayfieldRect
): { x: number; y: number } {
  const x = (px - rect.left) / rect.width;
  const y = (py - rect.top) / rect.height;
  return { x, y };
}

/** 정규화 0..1 → 픽셀 (공 중심) */
export function normalizedToPixel(
  x: number,
  y: number,
  rect: PlayfieldRect
): { px: number; py: number } {
  const px = rect.left + x * rect.width;
  const py = rect.top + y * rect.height;
  return { px, py };
}

/**
 * 공 외곽 원 전체가 플레이필드 안에 있도록 공 중심 좌표를 보정.
 * 공 중심은 플레이필드 경계에서 ballRadius 만큼 안쪽에 있어야 하며,
 * ballRadius는 플레이필드 긴 변 기준 getBallRadius(longSide) 사용.
 * 적용: 공 드래그 이동, 배치 완료, 테이블 회전 후 위치 계산.
 */
export function clampBallToPlayfield(
  x: number,
  y: number,
  rect: PlayfieldRect
): { x: number; y: number } {
  const ballRadius = getBallRadius(getPlayfieldLongSide(rect));
  const playFieldLeft = rect.left;
  const playFieldRight = rect.left + rect.width;
  const playFieldTop = rect.top;
  const playFieldBottom = rect.top + rect.height;

  const centerPx = rect.left + x * rect.width;
  const centerPy = rect.top + y * rect.height;

  const clampedPx = Math.max(
    playFieldLeft + ballRadius,
    Math.min(centerPx, playFieldRight - ballRadius)
  );
  const clampedPy = Math.max(
    playFieldTop + ballRadius,
    Math.min(centerPy, playFieldBottom - ballRadius)
  );

  return {
    x: (clampedPx - rect.left) / rect.width,
    y: (clampedPy - rect.top) / rect.height,
  };
}

/** 터치/클릭 지점이 플레이필드 내인지 */
export function isInsidePlayfield(
  px: number,
  py: number,
  rect: PlayfieldRect
): boolean {
  return (
    px >= rect.left &&
    px <= rect.left + rect.width &&
    py >= rect.top &&
    py <= rect.top + rect.height
  );
}

/**
 * 경로 스팟포인트 허용 영역: 플레이필드 + 레일(쿠션) 경계까지.
 * 정규화 0..1 클램프 (쿠션 바깥·테이블 바깥 금지).
 */
export function clampPathPointToAllowedRegion(
  x: number,
  y: number
): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

/**
 * 드래그 시 새 위치 후보가 다른 공과 겹치지 않을 때만 반환.
 * distance < ballDiameter 이면 null (해당 위치로 이동하지 않음, 마지막 유효 위치 유지).
 * 실시간 검사용. 겹친 뒤 되돌리지 않고, 겹치는 위치로 못 들어가게 함.
 */
export function getDragPositionIfValid(
  newX: number,
  newY: number,
  movingBall: BallColor,
  redBall: { x: number; y: number },
  yellowBall: { x: number; y: number },
  whiteBall: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } | null {
  const clamped = clampBallToPlayfield(newX, newY, rect);
  const minBallDistancePx = getBallDiameter(getPlayfieldLongSide(rect));
  const posPx = normalizedToPixel(clamped.x, clamped.y, rect);
  const others: { x: number; y: number }[] = [];
  if (movingBall !== "red") others.push(redBall);
  if (movingBall !== "yellow") others.push(yellowBall);
  if (movingBall !== "white") others.push(whiteBall);
  for (const o of others) {
    const oPx = normalizedToPixel(o.x, o.y, rect);
    const d = Math.hypot(posPx.px - oPx.px, posPx.py - oPx.py);
    if (d < minBallDistancePx) return null;
  }
  return clamped;
}

/**
 * 공 배치 시 다른 공과 겹치지 않도록 위치 조정.
 * 플레이필드 클램프 + 두 공 중심 거리 >= ballDiameter 유지.
 * (회전 후 보정 등에 사용. 드래그 중 실시간은 getDragPositionIfValid 사용)
 */
export function clampBallToPlayfieldAndNoOverlap(
  newX: number,
  newY: number,
  movingBall: BallColor,
  redBall: { x: number; y: number },
  yellowBall: { x: number; y: number },
  whiteBall: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } {
  const minBallDistancePx = getBallDiameter(getPlayfieldLongSide(rect)); // 두 공 중심 거리 >= 공 지름
  let { x: px, y: py } = clampBallToPlayfield(newX, newY, rect);
  const others: { x: number; y: number }[] = [];
  if (movingBall !== "red") others.push(redBall);
  if (movingBall !== "yellow") others.push(yellowBall);
  if (movingBall !== "white") others.push(whiteBall);

  for (let iter = 0; iter < 3; iter++) {
    let changed = false;
    const posPx = normalizedToPixel(px, py, rect);
    for (const o of others) {
      const oPx = normalizedToPixel(o.x, o.y, rect);
      const d = Math.hypot(posPx.px - oPx.px, posPx.py - oPx.py);
      if (d < minBallDistancePx && d > 0) {
        const scale = minBallDistancePx / d;
        const nx = oPx.px + (posPx.px - oPx.px) * scale;
        const ny = oPx.py + (posPx.py - oPx.py) * scale;
        const norm = pixelToNormalized(nx, ny, rect);
        px = norm.x;
        py = norm.y;
        changed = true;
      }
    }
    if (changed) {
      const reClamp = clampBallToPlayfield(px, py, rect);
      px = reClamp.x;
      py = reClamp.y;
    } else break;
  }
  return clampBallToPlayfield(px, py, rect);
}

/** 클릭 지점(픽셀)에서 맞은 공 반환. 없으면 null */
export function hitTestBall(
  px: number,
  py: number,
  redBall: { x: number; y: number },
  yellowBall: { x: number; y: number },
  whiteBall: { x: number; y: number },
  rect: PlayfieldRect
): BallColor | null {
  const r = getBallRadius(getPlayfieldLongSide(rect));
  const balls: { id: BallColor; x: number; y: number }[] = [
    { id: "red", ...redBall },
    { id: "yellow", ...yellowBall },
    { id: "white", ...whiteBall },
  ];
  for (let i = balls.length - 1; i >= 0; i--) {
    const { px: bx, py: by } = normalizedToPixel(balls[i].x, balls[i].y, rect);
    if (Math.hypot(px - bx, py - by) <= r) return balls[i].id;
  }
  return null;
}
