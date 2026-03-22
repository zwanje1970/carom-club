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
 * 경로 스팟 원 반지름(px, 캔버스 좌표) — `BilliardTableCanvas` 경로 점 표시와 동일.
 * 슬라이드 탭 포인트 등 UI에서 시각 일치용.
 */
export const PATH_SPOT_RADIUS_PX = 10;

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
/** 수구: 흰공 또는 노란공만 허용. red는 수구가 될 수 없음. */
export type CueBallType = "white" | "yellow";
/** 목적구 색 (현재 1개만 사용). 수구와 역할 분리. */
export type ObjectBallType = "red";
/** 공의 역할: 수구 vs 목적구 */
export type BallRole = "cue" | "object";

/** 수구 색상 → 렌더용 hex (white → 흰공, yellow → 노란공) */
export function getCueBallColor(cueBallType: CueBallType): string {
  return cueBallType === "yellow" ? "#f5d033" : "#f8f8f8";
}

/** 목적구 색상 → 렌더용 hex. red 고정. */
export function getObjectBallColor(_objectBallType?: ObjectBallType): string {
  return "#c41e3a";
}

/** 목적구(노란공) when cue is white — 렌더용 hex */
export function getObjectBallYellowColor(): string {
  return "#f5d033";
}

/** ballColor가 현재 수구(cueBallType)이면 true. red는 항상 false. */
export function isCueBall(ballColor: BallColor, cueBallType: CueBallType): boolean {
  return ballColor === cueBallType;
}

/** ballColor가 목적구이면 true (수구가 아닌 공). red는 항상 목적구. */
export function isObjectBall(ballColor: BallColor, cueBallType: CueBallType): boolean {
  return ballColor !== cueBallType;
}

/**
 * 외부 입력(API/폼)을 CueBallType으로 정규화.
 * white | yellow만 허용. red 등 잘못된 값은 white로 fallback하고 로그.
 */
export function normalizeCueBallType(v: unknown): CueBallType {
  if (v === "yellow") return "yellow";
  if (v === "white") return "white";
  if (v === "red" || (typeof v === "string" && v.trim().toLowerCase() === "red")) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
      console.warn("[normalizeCueBallType] invalid cueBall value 'red' received; using 'white'. red is object-only.");
    }
  }
  return "white";
}

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

/** 플레이필드 표시 그리드 — `BilliardTableCanvas`와 동일: 긴 변 8칸·짧은 변 4칸 */
export const PLAYFIELD_GRID_LONG_DIVS = 8;
export const PLAYFIELD_GRID_SHORT_DIVS = 4;

/**
 * 그리드 한 칸의 한 변 길이(px). portrait 시 가로/세로 분할 수가 바뀜.
 * 직전 스팟→자동 쿠션 교차까지 허용 거리 상한 등에 사용.
 */
export function playfieldGridOneCellEdgePx(rect: PlayfieldRect, portrait: boolean): number {
  const nDivX = portrait ? PLAYFIELD_GRID_SHORT_DIVS : PLAYFIELD_GRID_LONG_DIVS;
  const nDivY = portrait ? PLAYFIELD_GRID_LONG_DIVS : PLAYFIELD_GRID_SHORT_DIVS;
  const stepX = rect.width / nDivX;
  const stepY = rect.height / nDivY;
  return Math.min(stepX, stepY);
}

/**
 * 직전 스팟→쿠션-only 교차점까지 거리가 이 한도 이하일 때만,
 * 쿠션/프레임 쪽 탭 시 쿠션 스팟+다음 스팟을 자동 연속 배치(경로 편집 공통).
 * 한도 = 그리드 1칸 × 배율 (기존 100%에서 축소 — 가까울 때만 자동).
 */
export const PATH_AUTO_CHAIN_NEAR_CUSHION_MAX_DISTANCE_GRID_FRACTION = 0.1;

export function pathAutoChainNearCushionMaxDistancePx(
  rect: PlayfieldRect,
  portrait: boolean
): number {
  return (
    playfieldGridOneCellEdgePx(rect, portrait) *
    PATH_AUTO_CHAIN_NEAR_CUSHION_MAX_DISTANCE_GRID_FRACTION
  );
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
 * 플레이필드 정규화 좌표(0..1) 두 점 사이 유클리드 거리(px).
 * 2:1 필드에서는 norm 공간의 hypot(dx,dy)가 실제 거리와 달라 공 탭·1목 스냅이 빗나가므로 픽셀 거리 사용.
 */
export function distanceNormPointsInPlayfieldPx(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: PlayfieldRect
): number {
  const pa = normalizedToPixel(a.x, a.y, rect);
  const pb = normalizedToPixel(b.x, b.y, rect);
  return Math.hypot(pa.px - pb.px, pa.py - pb.py);
}

/**
 * 당구노트 공 배치(`BilliardTableEditor` placementMode)와 동일 — `hitTestBall` 의 반지름 배수.
 * 난구해법·경로 편집의 공/수구 탭도 이 값과 맞춤.
 */
export const BALL_PLACEMENT_TOUCH_RADIUS_SCALE = 6;

/** 당구노트 공 배치 터치 반경(px) — 공 반지름 × {@link BALL_PLACEMENT_TOUCH_RADIUS_SCALE} */
export function getBallPlacementTouchRadiusPx(rect: PlayfieldRect): number {
  return getBallRadius(getPlayfieldLongSide(rect)) * BALL_PLACEMENT_TOUCH_RADIUS_SCALE;
}

/** 경로 편집·난구 수구/공 탭 — {@link getBallPlacementTouchRadiusPx} 와 동일 */
export function getSolutionPathBallTapRadiusPx(rect: PlayfieldRect): number {
  return getBallPlacementTouchRadiusPx(rect);
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

/**
 * 클릭/터치 지점(픽셀)에서 맞은 공 반환. 없으면 null.
 * @param hitRadiusScale 공 반지름의 배수 (기본 1). 당구노트 공 배치는 {@link BALL_PLACEMENT_TOUCH_RADIUS_SCALE}.
 */
export function hitTestBall(
  px: number,
  py: number,
  redBall: { x: number; y: number },
  yellowBall: { x: number; y: number },
  whiteBall: { x: number; y: number },
  rect: PlayfieldRect,
  hitRadiusScale: number = 1
): BallColor | null {
  const r = getBallRadius(getPlayfieldLongSide(rect)) * hitRadiusScale;
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
