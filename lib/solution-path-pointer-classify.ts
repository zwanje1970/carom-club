/**
 * 경로 편집 오버레이와 동일한 기준으로 포인터 위치를 분류한다.
 * (빈 공간 드래그 패닝 vs 공/스팟/세그먼트 조작 분리용)
 */
import {
  getPlayfieldRect,
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
  distanceNormPointsInPlayfieldPx,
  getSolutionPathBallTapRadiusPx,
  normalizedToPixel,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { getNonCueBallNorms, type NanguBallPlacement, type NanguPathPoint } from "@/lib/nangu-types";
import {
  ballCircumferenceNormFacingApproach,
  cueFirstObjectHitAmongNormalized,
} from "@/lib/solution-path-geometry";

/** 스팟/세그먼트 히트 — 플레이필드 px 기준 (2:1에서 norm hypot 왜곡 방지) */
const SPOT_HIT_PX = 30;
/** 마지막 스팟(화살표 끝·쿠션 닿음)은 세그먼트 선에 가려져 드래그가 안 되는 경우가 있어 넓게 */
const SPOT_HIT_LAST_PX = 48;
const SEGMENT_HIT_PX = 22;

/** @deprecated zoom 포커스용; 공 탭은 getSolutionPathBallTapRadiusPx(rect) 사용 */
export const SOLUTION_PATH_BALL_PICK_ZOOM_NORM = 0.055;

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1e-6;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (len * len)));
  const qx = x1 + t * dx;
  const qy = y1 + t * dy;
  return Math.hypot(px - qx, py - qy);
}

/** 정규화 좌표 점~선분 거리(px) — 선분도 플레이필드상 직선으로 변환 */
function distNormPointToSegmentPx(
  nx: number,
  ny: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  rect: PlayfieldRect
): number {
  const p = normalizedToPixel(nx, ny, rect);
  const a = normalizedToPixel(x1, y1, rect);
  const b = normalizedToPixel(x2, y2, rect);
  return distToSegment(p.px, p.py, a.px, a.py, b.px, b.py);
}

export type PathPointerClassification =
  | { kind: "inactive" }
  | { kind: "ball" }
  /** 경로 입력 모드가 꺼져 있어도 수구 탭(재생 초기화·더블탭 CTA)용 */
  | { kind: "cueBallPlayback" }
  | { kind: "cueSpot"; id: string }
  | { kind: "objectSpot"; id: string }
  | { kind: "cueSegment"; segmentIndex: number }
  | { kind: "objectSegment"; segmentIndex: number }
  | { kind: "emptyCue" }
  /** pathMode에서 목적구(비수구) 넓은 터치 반경 — `emptyCue`와 동일 처리, 패닝용 빈 영역으로 보지 않음 */
  | { kind: "pathObjectBallTap" }
  | { kind: "emptyObject" };

export function isClassificationEmptyForPan(c: PathPointerClassification): boolean {
  return c.kind === "emptyCue" || c.kind === "emptyObject";
}

export function classifySolutionPathPointerHit(params: {
  norm: { x: number; y: number };
  pathMode: boolean;
  objectPathMode: boolean;
  cuePos: { x: number; y: number };
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  objectBallNorm?: { x: number; y: number } | null;
  ballPickLayout?: NanguBallPlacement | null;
  /** 1목 충돌 계산용 배치 — `ballPickLayout` 없을 때(미리보기 등) */
  collisionLayout?: NanguBallPlacement | null;
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  width?: number;
  height?: number;
  /** true: path/object 모드가 꺼져 있어도 수구만 먼저 히트 판정 */
  allowCuePlaybackGestures?: boolean;
}): PathPointerClassification {
  const {
    norm,
    pathMode,
    objectPathMode,
    cuePos,
    pathPoints,
    objectPathPoints,
    objectBallNorm,
    ballPickLayout,
    collisionLayout,
    ballNormOverrides,
    width = DEFAULT_TABLE_WIDTH,
    height = DEFAULT_TABLE_HEIGHT,
    allowCuePlaybackGestures = false,
  } = params;

  const rect = getPlayfieldRect(width, height);
  const ballTapPx = getSolutionPathBallTapRadiusPx(rect);

  const layoutForCollision = ballPickLayout ?? collisionLayout ?? null;

  if (
    allowCuePlaybackGestures &&
    layoutForCollision &&
    pathPoints.length >= 1
  ) {
    const cueKey = layoutForCollision.cueBall === "yellow" ? "yellow" : "white";
    const layoutCueNorm =
      cueKey === "yellow" ? layoutForCollision.yellowBall : layoutForCollision.whiteBall;
    const currentCueNorm = ballNormOverrides?.[cueKey] ?? layoutCueNorm;
    const hitCurrent = distanceNormPointsInPlayfieldPx(norm, currentCueNorm, rect) <= ballTapPx;
    const hitOriginal = distanceNormPointsInPlayfieldPx(norm, layoutCueNorm, rect) <= ballTapPx;
    /** 재생 후 수구가 원래 자리에서 떠 있을 때만 — 원래 자리 탭으로도 복귀 허용 */
    const cueVisuallyMoved =
      distanceNormPointsInPlayfieldPx(currentCueNorm, layoutCueNorm, rect) > 4;
    if (hitCurrent || (cueVisuallyMoved && hitOriginal)) {
      return { kind: "cueBallPlayback" };
    }
  }

  if (!pathMode && !objectPathMode) return { kind: "inactive" };

  /**
   * 1목 경로 시작점(충돌점) — `SolutionPathEditorFullscreen`의 cueToFirstObjectHit와 동일.
   * 수구 경로 첫 스팟이 없으면: 수구에 가장 가까운 목적구 원주(수구 방향) — 분류에서도 collisionNorm 필요.
   */
  let collisionNorm: { x: number; y: number } | null = null;
  if (pathPoints.length >= 1) {
    const firstForCollision =
      layoutForCollision
        ? getNonCueBallNorms(layoutForCollision)
        : objectBallNorm
          ? [{ key: "red" as const, x: objectBallNorm.x, y: objectBallNorm.y }]
          : null;
    if (firstForCollision && firstForCollision.length > 0) {
      collisionNorm =
        cueFirstObjectHitAmongNormalized(cuePos, pathPoints[0], firstForCollision, rect)?.collision ?? null;
    }
  } else if (layoutForCollision) {
    const nonCue = getNonCueBallNorms(layoutForCollision);
    if (nonCue.length > 0) {
      let nearest = nonCue[0]!;
      let bestD = Infinity;
      for (const b of nonCue) {
        const d = distanceNormPointsInPlayfieldPx(cuePos, { x: b.x, y: b.y }, rect);
        if (d < bestD) {
          bestD = d;
          nearest = b;
        }
      }
      collisionNorm = ballCircumferenceNormFacingApproach(
        { x: nearest.x, y: nearest.y },
        cuePos,
        rect
      );
    }
  } else if (objectBallNorm) {
    collisionNorm = ballCircumferenceNormFacingApproach(
      { x: objectBallNorm.x, y: objectBallNorm.y },
      cuePos,
      rect
    );
  }

  /**
   * 1목·수구 스팟/세그먼트가 공(줌)보다 먼저 — 공 표면에 찍힌 스팟도 드래그·삭제·세그먼트 삽입 가능.
   * 그 다음 공 탭(줌), 마지막에 빈 영역(emptyCue / emptyObject).
   */
  if (objectPathMode && collisionNorm) {
    for (let pi = 0; pi < objectPathPoints.length; pi++) {
      const p = objectPathPoints[pi]!;
      const hitPx = pi === objectPathPoints.length - 1 ? SPOT_HIT_LAST_PX : SPOT_HIT_PX;
      if (distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) < hitPx) {
        return { kind: "objectSpot", id: p.id };
      }
    }
    const objChain = [collisionNorm, ...objectPathPoints.map((p) => ({ x: p.x, y: p.y }))];
    for (let i = 0; i < objChain.length - 1; i++) {
      const a = objChain[i];
      const b = objChain[i + 1];
      const dist = distNormPointToSegmentPx(norm.x, norm.y, a.x, a.y, b.x, b.y, rect);
      if (dist < SEGMENT_HIT_PX) {
        const lastObj = objectPathPoints[objectPathPoints.length - 1];
        if (
          lastObj &&
          i === objChain.length - 2 &&
          distanceNormPointsInPlayfieldPx(norm, { x: b.x, y: b.y }, rect) < SPOT_HIT_LAST_PX
        ) {
          continue;
        }
        return { kind: "objectSegment", segmentIndex: i };
      }
    }
  }

  if (pathMode) {
    for (let pi = 0; pi < pathPoints.length; pi++) {
      const p = pathPoints[pi]!;
      const hitPx = pi === pathPoints.length - 1 ? SPOT_HIT_LAST_PX : SPOT_HIT_PX;
      if (distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect) < hitPx) {
        return { kind: "cueSpot", id: p.id };
      }
    }
    const allPts = [cuePos, ...pathPoints];
    for (let i = 0; i < allPts.length - 1; i++) {
      const a = allPts[i];
      const b = allPts[i + 1];
      const dist = distNormPointToSegmentPx(norm.x, norm.y, a.x, a.y, b.x, b.y, rect);
      if (dist < SEGMENT_HIT_PX) {
        const lastCue = pathPoints[pathPoints.length - 1];
        if (
          lastCue &&
          pathPoints.length >= 1 &&
          i === pathPoints.length - 1 &&
          distanceNormPointsInPlayfieldPx(norm, { x: b.x, y: b.y }, rect) < SPOT_HIT_LAST_PX
        ) {
          continue;
        }
        return { kind: "cueSegment", segmentIndex: i };
      }
    }
  }

  if ((pathMode || objectPathMode) && ballPickLayout) {
    const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
    const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
    const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
    const cueBall = ballPickLayout.cueBall === "yellow" ? "yellow" : "white";
    /** 노란/흰 중 수구만 true — 빨강은 항상 목적구 후보 */
    const isCueBallKey = (key: "red" | "yellow" | "white") =>
      key !== "red" && key === cueBall;

    for (const { key, b } of [
      { key: "red" as const, b: rb },
      { key: "yellow" as const, b: yb },
      { key: "white" as const, b: wb },
    ]) {
      if (distanceNormPointsInPlayfieldPx(norm, b, rect) <= ballTapPx) {
        /** 1목 경로 모드: 목적구(비수구) 탭은 스팟 추가 — 수구 탭만 줌용 `ball` */
        if (objectPathMode && !isCueBallKey(key)) {
          return { kind: "emptyObject" };
        }
        /** 수구 경로: 목적구 터치 반경이면 끝점이 공에 안 닿아도 목적구에 스팟 스냅 */
        if (pathMode && !isCueBallKey(key)) {
          return { kind: "pathObjectBallTap" };
        }
        return { kind: "ball" };
      }
    }
  }

  if (objectPathMode && collisionNorm) {
    return { kind: "emptyObject" };
  }
  if (pathMode) {
    return { kind: "emptyCue" };
  }

  return { kind: "inactive" };
}
