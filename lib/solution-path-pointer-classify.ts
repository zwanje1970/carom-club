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
const SPOT_HIT_PX = 18;
/** 마지막 스팟(화살표 끝·쿠션 닿음)은 세그먼트 선에 가려져 드래그가 안 되는 경우가 있어 넓게 */
const SPOT_HIT_LAST_PX = 26;
const SEGMENT_HIT_PX = 22;

/** 터치가 여러 스팟 반경에 겹칠 때 — 거리(px)가 가장 가까운 스팟 id (없으면 null) */
function pickNearestCueSpotId(
  norm: { x: number; y: number },
  pathPoints: NanguPathPoint[],
  rect: PlayfieldRect
): string | null {
  let bestId: string | null = null;
  let bestD = Infinity;
  for (let pi = 0; pi < pathPoints.length; pi++) {
    const p = pathPoints[pi]!;
    const maxHitPx = pi === pathPoints.length - 1 ? SPOT_HIT_LAST_PX : SPOT_HIT_PX;
    const d = distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect);
    if (d <= maxHitPx && d < bestD) {
      bestD = d;
      bestId = p.id;
    }
  }
  return bestId;
}

function pickNearestObjectSpotId(
  norm: { x: number; y: number },
  objectPathPoints: NanguPathPoint[],
  rect: PlayfieldRect
): string | null {
  let bestId: string | null = null;
  let bestD = Infinity;
  for (let pi = 0; pi < objectPathPoints.length; pi++) {
    const p = objectPathPoints[pi]!;
    const maxHitPx = pi === objectPathPoints.length - 1 ? SPOT_HIT_LAST_PX : SPOT_HIT_PX;
    const d = distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect);
    if (d <= maxHitPx && d < bestD) {
      bestD = d;
      bestId = p.id;
    }
  }
  return bestId;
}

function pickNearestSecondObjectSpotId(
  norm: { x: number; y: number },
  secondObjectPathPoints: NanguPathPoint[],
  rect: PlayfieldRect
): string | null {
  let bestId: string | null = null;
  let bestD = Infinity;
  for (let pi = 0; pi < secondObjectPathPoints.length; pi++) {
    const p = secondObjectPathPoints[pi]!;
    const maxHitPx = pi === secondObjectPathPoints.length - 1 ? SPOT_HIT_LAST_PX : SPOT_HIT_PX;
    const d = distanceNormPointsInPlayfieldPx(norm, { x: p.x, y: p.y }, rect);
    if (d <= maxHitPx && d < bestD) {
      bestD = d;
      bestId = p.id;
    }
  }
  return bestId;
}

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
  /** 경로 입력 모드가 꺼져 있어도 수구 탭(재생 중 초기화)용 */
  | { kind: "cueBallPlayback" }
  | { kind: "cueSpot"; id: string }
  | { kind: "objectSpot"; id: string }
  | { kind: "secondObjectSpot"; id: string }
  | { kind: "cueSegment"; segmentIndex: number }
  | { kind: "objectSegment"; segmentIndex: number }
  | { kind: "secondObjectSegment"; segmentIndex: number }
  | { kind: "emptyCue" }
  /** pathMode에서 수구 경로 스팟 추가: 탭이 목적구 원 안 — 반직선으로 공 접촉 스팟 생성(버튼으로 레이어 선택 시) */
  | { kind: "cueBallContactAppend"; ballKey: "red" | "yellow" | "white" }
  /** pathMode에서 목적구(비수구) 넓은 터치 반경 — `emptyCue`와 동일 처리, 패닝용 빈 영역으로 보지 않음 */
  | { kind: "pathObjectBallTap" }
  /** objectPathMode에서 목적구(1목) 공 표면 탭 — 빈 테이블 `emptyObject`와 구분 */
  | { kind: "objectBallMarkingTap" }
  | { kind: "pathSecondObjectBallTap" }
  | { kind: "emptyObject2" }
  | { kind: "emptyObject" };

export function isClassificationEmptyForPan(c: PathPointerClassification): boolean {
  return c.kind === "emptyCue" || c.kind === "emptyObject" || c.kind === "emptyObject2";
}

/**
 * 목적구 탭이 **1목 편집 대상 공**과 일치할 때만 1목 경로 편집 활성으로 인정한다.
 * 2목 레이어 활성 여부는 에디터의 2목 접촉 geometry(수구·1목 경로 스팟)로 별도 결정된다.
 * `pathEditFirstObjectBallKey === undefined` → 제한 없음(하위 호환).
 * `pathEditFirstObjectBallKey === null` 이고 수구 경로 스팟이 아직 없으면(`cuePathPointsLength === 0`)
 * `cueToFirstObjectHit`가 비어 있어 생긴 상태이므로 목적구 탭을 막지 않는다(공 표면 스팟·레이어 전환).
 */
export function canActivatePathEditForObjectBallTap(params: {
  hitBallKey: "red" | "yellow" | "white";
  pathEditFirstObjectBallKey: "red" | "yellow" | "white" | null | undefined;
  objectPathPointsLength: number;
  cuePathPointsLength: number;
}): boolean {
  const { hitBallKey, pathEditFirstObjectBallKey, cuePathPointsLength } = params;
  if (pathEditFirstObjectBallKey === undefined) return true;
  if (pathEditFirstObjectBallKey === null) return cuePathPointsLength === 0;
  return hitBallKey === pathEditFirstObjectBallKey;
}

export function classifySolutionPathPointerHit(params: {
  norm: { x: number; y: number };
  pathMode: boolean;
  objectPathMode: boolean;
  secondObjectPathMode?: boolean;
  cuePos: { x: number; y: number };
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  secondObjectPathPoints?: NanguPathPoint[];
  objectBallNorm?: { x: number; y: number } | null;
  ballPickLayout?: NanguBallPlacement | null;
  /** 1목 충돌 계산용 배치 — `ballPickLayout` 없을 때(미리보기 등) */
  collisionLayout?: NanguBallPlacement | null;
  ballNormOverrides?: Partial<Record<"red" | "yellow" | "white", { x: number; y: number }>>;
  width?: number;
  height?: number;
  /** true: path/object 모드가 꺼져 있어도 수구만 먼저 히트 판정 */
  allowCuePlaybackGestures?: boolean;
  /** true일 때만 수구 탭을 재생 제스처(cueBallPlayback)로 분류 — 재생 중이 아니면 공 탭으로 넘겨 경로 레이어 전환에 사용 */
  pathPlaybackActive?: boolean;
  /**
   * 정의되면 내부 계산 대신 이 값을 1목 충돌점으로 사용(null이면 1목 경로·pathObjectBallTap 비활성).
   * 에디터에서 “수구 경로가 광선상 충돌에 실제로 닿음”을 반영할 때 전달.
   */
  objectPathCollisionNormOverride?: { x: number; y: number } | null;
  /**
   * 2목 충돌점 오버라이드. 2목 경로 시작점.
   */
  secondObjectPathCollisionNormOverride?: { x: number; y: number } | null;
  /**
   * 1목 공 키(광선·충돌 기준). 전달 시 `pathObjectBallTap` / `objectBallMarkingTap`에 탭 권한 검사 적용.
   * 미전달(`undefined`)이면 기존 분류(하위 호환).
   */
  pathEditFirstObjectBallKey?: "red" | "yellow" | "white" | null;
  /**
   * true(기본): 수구 경로 모드에서 목적구 탭 시 1목 레이어 전환(`pathObjectBallTap`) 가능.
   * false: 레이어는 버튼으로만 전환 — 목적구 탭은 수구 경로에 **공 접촉 스팟** 추가로 처리.
   */
  objectBallTapSwitchesCueToObjectLayer?: boolean;
}): PathPointerClassification {
  const {
    norm,
    pathMode,
    objectPathMode,
    secondObjectPathMode = false,
    cuePos,
    pathPoints,
    objectPathPoints,
    secondObjectPathPoints = [],
    objectBallNorm,
    ballPickLayout,
    collisionLayout,
    ballNormOverrides,
    width = DEFAULT_TABLE_WIDTH,
    height = DEFAULT_TABLE_HEIGHT,
    allowCuePlaybackGestures = false,
    pathPlaybackActive = false,
    objectPathCollisionNormOverride,
    secondObjectPathCollisionNormOverride,
    pathEditFirstObjectBallKey,
    objectBallTapSwitchesCueToObjectLayer = true,
  } = params;

  const rect = getPlayfieldRect(width, height);
  const ballTapPx = getSolutionPathBallTapRadiusPx(rect);

  const layoutForCollision = ballPickLayout ?? collisionLayout ?? null;

  if (
    allowCuePlaybackGestures &&
    pathPlaybackActive &&
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

  if (!pathMode && !objectPathMode && !secondObjectPathMode) return { kind: "inactive" };

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

  if (objectPathCollisionNormOverride !== undefined) {
    collisionNorm = objectPathCollisionNormOverride;
  }

  let secondObjectCollisionNorm: { x: number; y: number } | null = null;
  if (secondObjectPathCollisionNormOverride !== undefined) {
    secondObjectCollisionNorm = secondObjectPathCollisionNormOverride;
  }

  if (secondObjectPathMode && secondObjectCollisionNorm) {
    const nearestSecond = pickNearestSecondObjectSpotId(norm, secondObjectPathPoints, rect);
    if (nearestSecond) {
      return { kind: "secondObjectSpot", id: nearestSecond };
    }
    const secondChain = [secondObjectCollisionNorm, ...secondObjectPathPoints.map((p) => ({ x: p.x, y: p.y }))];
    for (let i = 0; i < secondChain.length - 1; i++) {
      const a = secondChain[i];
      const b = secondChain[i + 1];
      const dist = distNormPointToSegmentPx(norm.x, norm.y, a.x, a.y, b.x, b.y, rect);
      if (dist < SEGMENT_HIT_PX) {
        const lastSecond = secondObjectPathPoints[secondObjectPathPoints.length - 1];
        if (
          lastSecond &&
          i === secondChain.length - 2 &&
          distanceNormPointsInPlayfieldPx(norm, { x: b.x, y: b.y }, rect) < SPOT_HIT_LAST_PX
        ) {
          continue;
        }
        return { kind: "secondObjectSegment", segmentIndex: i };
      }
    }
  }

  /**
   * 1목·수구 스팟/세그먼트가 공(줌)보다 먼저 — 공 표면에 찍힌 스팟도 드래그·삭제·세그먼트 삽입 가능.
   * 그 다음 공 탭(줌), 마지막에 빈 영역(emptyCue / emptyObject).
   */
  if (objectPathMode && collisionNorm) {
    const nearestObj = pickNearestObjectSpotId(norm, objectPathPoints, rect);
    if (nearestObj) {
      return { kind: "objectSpot", id: nearestObj };
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

  if (secondObjectPathMode && secondObjectCollisionNorm) {
    return { kind: "emptyObject2" };
  }
  if (pathMode) {
    const nearestCue = pickNearestCueSpotId(norm, pathPoints, rect);
    if (nearestCue) {
      return { kind: "cueSpot", id: nearestCue };
    }
    /**
     * 목적구 표면 탭이 수구 경로 세그먼트(22px) 근접보다 뒤지면 cueSegment로만 분류되어
     * 공 접촉 스팟 추가·1목 레이어 전환이 되지 않는다. 스팟 미스 후보가 없을 때만 우선한다.
     */
    if (ballPickLayout) {
      const rb = ballNormOverrides?.red ?? ballPickLayout.redBall;
      const yb = ballNormOverrides?.yellow ?? ballPickLayout.yellowBall;
      const wb = ballNormOverrides?.white ?? ballPickLayout.whiteBall;
      const cueBall = ballPickLayout.cueBall === "yellow" ? "yellow" : "white";
      const isCueBallKey = (key: "red" | "yellow" | "white") =>
        key !== "red" && key === cueBall;
      for (const { key, b } of [
        { key: "red" as const, b: rb },
        { key: "yellow" as const, b: yb },
        { key: "white" as const, b: wb },
      ]) {
        if (distanceNormPointsInPlayfieldPx(norm, b, rect) > ballTapPx) continue;
        if (isCueBallKey(key)) continue;
        if (objectBallTapSwitchesCueToObjectLayer) {
          if (!collisionNorm) return { kind: "ball" };
          if (
            !canActivatePathEditForObjectBallTap({
              hitBallKey: key,
              pathEditFirstObjectBallKey,
              objectPathPointsLength: objectPathPoints.length,
              cuePathPointsLength: pathPoints.length,
            })
          ) {
            return { kind: "ball" };
          }
          return { kind: "pathObjectBallTap" };
        }
        return { kind: "cueBallContactAppend", ballKey: key };
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

  if ((pathMode || objectPathMode || secondObjectPathMode) && ballPickLayout) {
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
        /** 2목 경로 모드: 2목 공 표면 탭 (현재는 1목과 동일 처리) */
        if (secondObjectPathMode && !isCueBallKey(key)) {
          if (!secondObjectCollisionNorm) return { kind: "ball" };
          const isFirstObj = key === pathEditFirstObjectBallKey;
          if (isFirstObj) return { kind: "ball" }; // 1목은 2목 모드에서 조작 대상 아님
          return { kind: "objectBallMarkingTap" }; // 2목 모드에서 2목 클릭 = 마킹/스팟 추가
        }

        /** 1목 경로 모드: 목적구 표식 — 수구 경로가 1목에 닿은 경우에만(충돌점 유효) */
        if (objectPathMode && !isCueBallKey(key)) {
          if (!collisionNorm) return { kind: "ball" };
          const isFirstObj = key === pathEditFirstObjectBallKey;
          if (!isFirstObj) {
            // 2목 클릭 시 2목 모드로 전환 유도 (pathSecondObjectBallTap)
            return { kind: "pathSecondObjectBallTap" };
          }
          return { kind: "objectBallMarkingTap" };
        }

        /** 수구 경로: 목적구 탭 — 레이어 전환 vs 공 접촉 스팟 추가 */
        if (pathMode && !isCueBallKey(key)) {
          if (objectBallTapSwitchesCueToObjectLayer) {
            if (!collisionNorm) return { kind: "ball" };
            if (
              !canActivatePathEditForObjectBallTap({
                hitBallKey: key,
                pathEditFirstObjectBallKey,
                objectPathPointsLength: objectPathPoints.length,
                cuePathPointsLength: pathPoints.length,
              })
            ) {
              return { kind: "ball" };
            }
            return { kind: "pathObjectBallTap" };
          }
          return { kind: "cueBallContactAppend", ballKey: key };
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
