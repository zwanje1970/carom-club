/**
 * 수구 진행 경로 규칙
 * - 경로 **선분**은 항상 수구 위치에서 첫 스팟으로 시작(렌더: `buildCuePathSegments`).
 * - **수구에서 이어지는 첫 스팟**은 **1목 후보 공 중심**(수구 제외 2구 중 탭에 가까운 쪽) 또는 **플레이필드·쿠션(레일) 안쪽 테두리**에만 연결.
 * - **쿠션 스팟 직후**에 이어지는 스팟도 **1목 후보 공 둘레** 또는 **다음 쿠션**·**end** 가능(수구 직후와 동일하게 목적구 스냅).
 * - **쿠션필드·프레임** 탭: 직전 점→탭 방향 반직선이 먼저 만나는 **쿠션 라인(플레이필드 경계)** 또는 **수구가 아닌 공의 원 둘레**에 스팟(`appendCuePathSpotWithAim` / `lib/cue-path-ray-resolve`).
 * - 직전이 **공(ball)** 인 구간: 다음은 쿠션 또는 end(기존).
 * - 선분 삽입: 수구~첫 스팟 구간, 또는 **직전 스팟이 쿠션인 구간**에만 1목 둘레 삽입 허용, 그 외 중간은 테두리만.
 * - **마지막 경로선(세그먼트)의 양끝 스팟만** 드래그로 이동(끝에서 두 번째·마지막). 직전이 공·쿠션이면 기존 스팟과 같은 위치에 다시 찍기 허용.
 */
import type { NanguBallPlacement, NanguPathPoint } from "@/lib/nangu-types";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  distanceNormPointsInPlayfieldPx,
  getPlayfieldRect,
  getSolutionPathBallTapRadiusPx,
  pathAutoChainNearCushionMaxDistancePx,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import {
  resolveCuePathRayHitLandscape,
  landscapeNormToPlayfieldCanvasPx,
  tableCanvasClampedToPlayfieldLandscapeNorm,
} from "@/lib/cue-path-ray-resolve";
import { spotCenterOnObjectBallExternalTangencyFromTap } from "@/lib/solution-path-geometry";

export function countCushionSpots(points: NanguPathPoint[]): number {
  return points.filter((p) => p.type === "cushion").length;
}

export function hasEndSpot(points: NanguPathPoint[]): boolean {
  return points.some((p) => p.type === "end");
}

/** 예전 3쿠션 조건 제거 — end는 사용자가 둔 대로 유지 */
export function stripInvalidEndSpots(points: NanguPathPoint[]): NanguPathPoint[] {
  return points;
}

const END_MARGIN = 0.02;

export function clampEndSpotPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(1 - END_MARGIN, Math.max(END_MARGIN, x)),
    y: Math.min(1 - END_MARGIN, Math.max(END_MARGIN, y)),
  };
}

/** 스냅 결과: 테두리 cushion | 1목적구 ball | 그 외 free */
export type CuePathSnapResult = { x: number; y: number; type: "cushion" | "free" | "ball" };
/** @deprecated CuePathSnapResult 사용 */
export type CushionSnapResult = CuePathSnapResult;

/**
 * - `firstFromCue`: 삽입 세그먼트가 수구~첫 스팟일 때 true(기존).
 * - `allowObjectBallSnap`: 명시 시 1목 후보 스냅 허용 여부(미입력이면 `firstFromCue`와 동일).
 * - `approachNorm` / `cueNorm`: 공 원주 스냅 시 진입 방향 기준(수구 또는 **직전 스팟**). `approachNorm` 우선.
 */
export type CuePathSnapContext = {
  firstFromCue: boolean;
  allowObjectBallSnap?: boolean;
  approachNorm?: { x: number; y: number };
  cueNorm?: { x: number; y: number };
};

/** 수구→첫 스팟 배치 시에만 1목적구 스냅 허용 */
export type CuePathSnapFn = (x: number, y: number, ctx: CuePathSnapContext) => CuePathSnapResult;
/** @deprecated CuePathSnapFn 사용 */
export type CushionSnapFn = CuePathSnapFn;

/**
 * 정규화 플레이필드 [0,1]² — 클로스와 쿠션이 만나는 **안쪽 네 변**에 스냅.
 * 여기에 닿지 않으면 `free`(체인 이어 붙이면 end 처리).
 */
export const PLAYFIELD_CUSHION_JUNCTION_EPS = 0.028;

export function snapToPlayfieldCushionJunction(x: number, y: number): CuePathSnapResult {
  const d0 = x;
  const d1 = 1 - x;
  const d2 = y;
  const d3 = 1 - y;
  const ds = [d0, d1, d2, d3];
  let mi = 0;
  for (let i = 1; i < 4; i++) {
    if (ds[i] < ds[mi]) mi = i;
  }
  if (ds[mi] > PLAYFIELD_CUSHION_JUNCTION_EPS) {
    return { x, y, type: "free" };
  }
  if (mi === 0) return { x: 0, y, type: "cushion" };
  if (mi === 1) return { x: 1, y, type: "cushion" };
  if (mi === 2) return { x, y: 0, type: "cushion" };
  return { x, y: 1, type: "cushion" };
}

/** @deprecated 1목 스냅은 플레이필드 px 거리 사용 (`getSolutionPathBallTapRadiusPx`) */
export const FIRST_OBJECT_BALL_SNAP_NORM = 0.045;

/**
 * 수구 경로 탭/드래그 스냅.
 * - 1목 후보 스냅: 수구→첫 스팟, 또는 **쿠션 직후** 스팟(`allowObjectBallSnap`).
 */
export function snapCuePathTap(
  x: number,
  y: number,
  firstObjectCandidates: { x: number; y: number }[] | null,
  ctx: CuePathSnapContext
): CuePathSnapResult {
  const allowBall = ctx.allowObjectBallSnap ?? ctx.firstFromCue;
  if (allowBall && firstObjectCandidates && firstObjectCandidates.length > 0) {
    const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);
    const snapPx = getSolutionPathBallTapRadiusPx(rect);
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const b of firstObjectCandidates) {
      const d = distanceNormPointsInPlayfieldPx({ x, y }, b, rect);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (best != null && bestD <= snapPx) {
      const approach = ctx.approachNorm ?? ctx.cueNorm;
      if (approach) {
        const segmentFrom = ctx.firstFromCue
          ? ctx.cueNorm ?? approach
          : ctx.approachNorm ?? ctx.cueNorm ?? approach;
        if (segmentFrom) {
          const surf = spotCenterOnObjectBallExternalTangencyFromTap(
            segmentFrom,
            { x, y },
            best,
            rect,
            firstObjectCandidates
          );
          return { type: "ball", x: surf.x, y: surf.y };
        }
      }
      return { type: "ball", x: best.x, y: best.y };
    }
  }
  return snapToPlayfieldCushionJunction(x, y);
}

/**
 * 1목 경로: 플레이필드 탭 시 목적구 후보 근처면 **원주**(직전 점 방향), 아니면 쿠션/자유.
 */
export function snapObjectPathPlayfieldTap(
  x: number,
  y: number,
  fromNorm: { x: number; y: number },
  objectCandidates: { x: number; y: number }[],
  rect: PlayfieldRect
): { x: number; y: number; type: "ball" | "cushion" | "free" } {
  const snapPx = getSolutionPathBallTapRadiusPx(rect);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const b of objectCandidates) {
    const d = distanceNormPointsInPlayfieldPx({ x, y }, b, rect);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (best != null && bestD <= snapPx) {
    const surf = spotCenterOnObjectBallExternalTangencyFromTap(
      fromNorm,
      { x, y },
      best,
      rect,
      objectCandidates
    );
    return { type: "ball", x: surf.x, y: surf.y };
  }
  return snapToPlayfieldCushionJunction(x, y);
}

export type CuePathMutationResult =
  | { ok: true; points: NanguPathPoint[] }
  | { ok: false; message: string };

/** 플레이필드 내 탭 | 쿠션·프레임 등 테이블 캔버스 좌표 탭(반직선 교차) */
export type PathPointerAim =
  | { kind: "playfield"; norm: { x: number; y: number } }
  | { kind: "tableCanvas"; cx: number; cy: number };

export type CuePathRayAppendContext = {
  cueLandscape: { x: number; y: number };
  canvasW: number;
  canvasH: number;
  portrait: boolean;
  collisionRectLandscape: PlayfieldRect;
  ballPlacement: NanguBallPlacement | null;
};

function lastPathSpot(prev: NanguPathPoint[]): NanguPathPoint | undefined {
  return prev.length ? prev[prev.length - 1] : undefined;
}

/**
 * 직전 스팟이 목적구(ball) 또는 쿠션이면, 새 스팟을 기존 스팟과 동일(근접) 위치에 다시 찍을 수 있다.
 */
export function cuePathAppendAllowsDuplicateCoincident(prev: NanguPathPoint[]): boolean {
  const last = lastPathSpot(prev);
  return last != null && (last.type === "ball" || last.type === "cushion");
}

/** 추가될 좌표가 이미 있는 스팟과 겹치면 true — 위 규칙으로 허용되면 false */
export function cuePathAppendWouldDuplicateExistingSpot(
  prev: NanguPathPoint[],
  added: { x: number; y: number },
  rect: PlayfieldRect,
  dupThresholdPx: number
): boolean {
  if (cuePathAppendAllowsDuplicateCoincident(prev)) return false;
  return prev.some(
    (p) =>
      distanceNormPointsInPlayfieldPx({ x: added.x, y: added.y }, { x: p.x, y: p.y }, rect) <
      dupThresholdPx
  );
}

/** 수구→첫 스팟 또는 직전이 쿠션일 때 1목 후보 스냅 허용 */
function allowObjectBallSnapAtPathIndex(prev: NanguPathPoint[], idx: number): boolean {
  return idx === 0 || prev[idx - 1]?.type === "cushion";
}

function approachNormForPathIndex(prev: NanguPathPoint[], idx: number): { x: number; y: number } | undefined {
  if (idx === 0) return undefined;
  const q = prev[idx - 1];
  return q ? { x: q.x, y: q.y } : undefined;
}

/** 반직선으로 구한 쿠션/공 둘레 점을 기존 규칙에 맞게 추가 */
function appendResolvedCueSpot(
  prev: NanguPathPoint[],
  resolved: { x: number; y: number; type: "cushion" | "ball" },
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "" };
  }
  const last = lastPathSpot(prev);
  if (!last) {
    if (resolved.type === "cushion") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: resolved.x, y: resolved.y, type: "cushion" }],
      };
    }
    if (resolved.type === "ball") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: resolved.x, y: resolved.y, type: "ball" }],
      };
    }
    return { ok: false, message: "내부 오류: 스팟 유형이 없습니다." };
  }
  if (last.type === "cushion") {
    if (resolved.type === "cushion") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: resolved.x, y: resolved.y, type: "cushion" }],
      };
    }
    if (resolved.type === "ball") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: resolved.x, y: resolved.y, type: "ball" }],
      };
    }
    const c = clampEndSpotPosition(resolved.x, resolved.y);
    return {
      ok: true,
      points: [...prev, { id: newId(), x: c.x, y: c.y, type: "end" }],
    };
  }
  if (last.type === "ball") {
    if (resolved.type === "cushion") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: resolved.x, y: resolved.y, type: "cushion" }],
      };
    }
    const c = clampEndSpotPosition(resolved.x, resolved.y);
    return {
      ok: true,
      points: [...prev, { id: newId(), x: c.x, y: c.y, type: "end" }],
    };
  }
  return { ok: false, message: "" };
}

function allowNonCueBallCircleForCueAppend(prev: NanguPathPoint[]): boolean {
  if (prev.length === 0) return true;
  return lastPathSpot(prev)?.type === "cushion";
}

/**
 * 직전 스팟이 쿠션이 아닐 때(공·free 등): 직전→탭 방향으로 먼저 쿠션 교차점을 넣은 뒤, 탭 위치를 스냅한 스팟을 이어 붙임.
 * (쿠션 밖 탭은 클램프된 플레이필드 좌표로 스냅)
 */
export function appendCuePathPlayfieldWithAutoCushion(
  prev: NanguPathPoint[],
  tapNorm: { x: number; y: number },
  snap: CuePathSnapFn,
  newId: () => string,
  rayCtx: CuePathRayAppendContext
): CuePathMutationResult {
  const last = lastPathSpot(prev);
  if (hasEndSpot(prev)) {
    return { ok: false, message: "" };
  }
  if (!last || last.type === "cushion") {
    return appendCuePathSpot(prev, tapNorm, snap, newId);
  }
  const aimCanvasPx = landscapeNormToPlayfieldCanvasPx(tapNorm, rayCtx.canvasW, rayCtx.canvasH, rayCtx.portrait);
  const cushionHit = resolveCuePathRayHitLandscape({
    fromLandscape: { x: last.x, y: last.y },
    aimCanvasPx,
    canvasW: rayCtx.canvasW,
    canvasH: rayCtx.canvasH,
    portrait: rayCtx.portrait,
    collisionRectLandscape: rayCtx.collisionRectLandscape,
    ballPlacement: rayCtx.ballPlacement,
    allowNonCueBallCircle: false,
  });
  if (!cushionHit || cushionHit.type !== "cushion") {
    return appendCuePathSpot(prev, tapNorm, snap, newId);
  }
  const prevWithCushion: NanguPathPoint[] = [
    ...prev,
    { id: newId(), x: cushionHit.x, y: cushionHit.y, type: "cushion" },
  ];
  return appendCuePathSpot(prevWithCushion, tapNorm, snap, newId);
}

function allowNonCueBallCircleForCueInsert(prev: NanguPathPoint[], segmentIndex: number): boolean {
  if (segmentIndex === 0) return true;
  return prev[segmentIndex - 1]?.type === "cushion";
}

export function appendCuePathSpotWithAim(
  prev: NanguPathPoint[],
  aim: PathPointerAim,
  snap: CuePathSnapFn,
  newId: () => string,
  rayCtx: CuePathRayAppendContext
): CuePathMutationResult {
  if (aim.kind === "playfield") {
    return appendCuePathPlayfieldWithAutoCushion(prev, aim.norm, snap, newId, rayCtx);
  }
  const last = lastPathSpot(prev);
  const fromLandscape = last ? { x: last.x, y: last.y } : rayCtx.cueLandscape;
  /** 직전이 쿠션이 아니면: 먼저 쿠션-only로 교차점 → 탭을 클램프·스냅한 스팟 연결 */
  if (last && last.type !== "cushion" && !hasEndSpot(prev)) {
    const cushionOnly = resolveCuePathRayHitLandscape({
      fromLandscape,
      aimCanvasPx: { x: aim.cx, y: aim.cy },
      canvasW: rayCtx.canvasW,
      canvasH: rayCtx.canvasH,
      portrait: rayCtx.portrait,
      collisionRectLandscape: rayCtx.collisionRectLandscape,
      ballPlacement: rayCtx.ballPlacement,
      allowNonCueBallCircle: false,
    });
    if (cushionOnly && cushionOnly.type === "cushion") {
      const maxAutoPx = pathAutoChainNearCushionMaxDistancePx(
        rayCtx.collisionRectLandscape,
        rayCtx.portrait
      );
      const distToCushion = distanceNormPointsInPlayfieldPx(
        fromLandscape,
        { x: cushionOnly.x, y: cushionOnly.y },
        rayCtx.collisionRectLandscape
      );
      if (distToCushion <= maxAutoPx) {
        const tapNorm = tableCanvasClampedToPlayfieldLandscapeNorm(
          aim.cx,
          aim.cy,
          rayCtx.canvasW,
          rayCtx.canvasH,
          rayCtx.portrait
        );
        const prevWithCushion: NanguPathPoint[] = [
          ...prev,
          { id: newId(), x: cushionOnly.x, y: cushionOnly.y, type: "cushion" },
        ];
        return appendCuePathSpot(prevWithCushion, tapNorm, snap, newId);
      }
    }
  }
  const hit = resolveCuePathRayHitLandscape({
    fromLandscape,
    aimCanvasPx: { x: aim.cx, y: aim.cy },
    canvasW: rayCtx.canvasW,
    canvasH: rayCtx.canvasH,
    portrait: rayCtx.portrait,
    collisionRectLandscape: rayCtx.collisionRectLandscape,
    ballPlacement: rayCtx.ballPlacement,
    allowNonCueBallCircle: allowNonCueBallCircleForCueAppend(prev),
  });
  if (!hit) {
    return {
      ok: false,
      message:
        "쿠션·프레임 쪽으로 직전 점에서 이은 직선이 플레이필드 경계(쿠션 라인)나 목적구 둘레와 만나는 지점을 찾지 못했습니다. 방향을 바꿔 다시 탭해 주세요.",
    };
  }
  return appendResolvedCueSpot(prev, hit, newId);
}

export function insertCuePathSpotWithAim(
  prev: NanguPathPoint[],
  segmentIndex: number,
  aim: PathPointerAim,
  snapFn: CuePathSnapFn,
  newId: () => string,
  rayCtx: CuePathRayAppendContext
): CuePathMutationResult {
  if (aim.kind === "playfield") {
    return insertCuePathSpot(prev, segmentIndex, aim.norm, snapFn, newId);
  }
  if (hasEndSpot(prev)) {
    return { ok: false, message: "마지막 스팟이 있으면 선분 삽입을 할 수 없습니다." };
  }
  const allowBallFromPrev = allowNonCueBallCircleForCueInsert(prev, segmentIndex);
  const chain: { x: number; y: number }[] = [rayCtx.cueLandscape, ...prev.map((p) => ({ x: p.x, y: p.y }))];
  const fromLandscape = chain[segmentIndex]!;
  const hit = resolveCuePathRayHitLandscape({
    fromLandscape,
    aimCanvasPx: { x: aim.cx, y: aim.cy },
    canvasW: rayCtx.canvasW,
    canvasH: rayCtx.canvasH,
    portrait: rayCtx.portrait,
    collisionRectLandscape: rayCtx.collisionRectLandscape,
    ballPlacement: rayCtx.ballPlacement,
    allowNonCueBallCircle: allowBallFromPrev,
  });
  if (!hit) {
    return {
      ok: false,
      message: "쿠션·프레임 방향으로 삽입할 위치를 찾지 못했습니다.",
    };
  }
  const okSpot = hit.type === "cushion" || (allowBallFromPrev && hit.type === "ball");
  if (!okSpot) {
    return {
      ok: false,
      message: allowBallFromPrev
        ? "수구 직후·쿠션 직후 구간만 목적구 둘레에 스팟을 넣을 수 있습니다. 그 외 중간 구간은 쿠션 라인만 가능합니다."
        : "중간에 넣는 스팟은 쿠션 라인 위만 가능합니다.",
    };
  }
  const next = [...prev];
  const type = hit.type === "ball" ? "ball" : "cushion";
  next.splice(segmentIndex, 0, { id: newId(), x: hit.x, y: hit.y, type });
  return { ok: true, points: next };
}

export function appendCuePathSpot(
  prev: NanguPathPoint[],
  norm: { x: number; y: number },
  snap: CuePathSnapFn,
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "" };
  }
  const last = lastPathSpot(prev);
  const snapped = snap(norm.x, norm.y, {
    firstFromCue: !last,
    allowObjectBallSnap: !last || last.type === "cushion",
    approachNorm: last ? { x: last.x, y: last.y } : undefined,
  });

  /** 첫 스팟: 수구에서 출발 — 1목 / 테두리(쿠션) / 그 외 end */
  if (!last) {
    if (snapped.type === "cushion") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: "cushion" }],
      };
    }
    if (snapped.type === "ball") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: "ball" }],
      };
    }
    const c = clampEndSpotPosition(norm.x, norm.y);
    return {
      ok: true,
      points: [...prev, { id: newId(), x: c.x, y: c.y, type: "end" }],
    };
  }

  /** 직전이 쿠션: 다음 쿠션 · 1목 둘레 · end */
  if (last.type === "cushion") {
    const chainSnap = snap(norm.x, norm.y, {
      firstFromCue: false,
      allowObjectBallSnap: true,
      approachNorm: { x: last.x, y: last.y },
    });
    if (chainSnap.type === "cushion") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: chainSnap.x, y: chainSnap.y, type: "cushion" }],
      };
    }
    if (chainSnap.type === "ball") {
      return {
        ok: true,
        points: [...prev, { id: newId(), x: chainSnap.x, y: chainSnap.y, type: "ball" }],
      };
    }
    const c = clampEndSpotPosition(norm.x, norm.y);
    return {
      ok: true,
      points: [...prev, { id: newId(), x: c.x, y: c.y, type: "end" }],
    };
  }

  /** 직전이 공(ball) 등: 쿠션만 이어 붙임, 아니면 끝 */
  const chainSnap = snap(norm.x, norm.y, { firstFromCue: false, allowObjectBallSnap: false });
  if (chainSnap.type === "cushion") {
    return {
      ok: true,
      points: [...prev, { id: newId(), x: chainSnap.x, y: chainSnap.y, type: "cushion" }],
    };
  }
  const c = clampEndSpotPosition(norm.x, norm.y);
  return {
    ok: true,
    points: [...prev, { id: newId(), x: c.x, y: c.y, type: "end" }],
  };
}

export function insertCuePathSpot(
  prev: NanguPathPoint[],
  segmentIndex: number,
  norm: { x: number; y: number },
  snap: CuePathSnapFn,
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "마지막 스팟이 있으면 선분 삽입을 할 수 없습니다." };
  }
  const allowObjectBallSnap = allowNonCueBallCircleForCueInsert(prev, segmentIndex);
  const snapped = snap(norm.x, norm.y, {
    firstFromCue: segmentIndex === 0,
    allowObjectBallSnap,
    approachNorm: approachNormForPathIndex(prev, segmentIndex),
  });
  const okSpot = snapped.type === "cushion" || (allowObjectBallSnap && snapped.type === "ball");
  if (!okSpot) {
    return {
      ok: false,
      message: allowObjectBallSnap
        ? "수구 직후·쿠션 직후 스팟은 1목 후보 공 또는 플레이필드·쿠션 테두리 위에만 넣을 수 있습니다. 그 외 중간 구간은 테두리 위만 가능합니다."
        : "중간에 넣는 스팟은 플레이필드와 쿠션이 만나는 테두리 위에만 둘 수 있습니다.",
    };
  }
  const next = [...prev];
  const type = snapped.type === "ball" ? "ball" : "cushion";
  next.splice(segmentIndex, 0, { id: newId(), x: snapped.x, y: snapped.y, type });
  return { ok: true, points: next };
}

/** 레일에 스냅되지 않으면 가장 가까운 쿠션 라인으로 투영 */
function projectToNearestRail(x: number, y: number): { x: number; y: number } {
  const d0 = x;
  const d1 = 1 - x;
  const d2 = y;
  const d3 = 1 - y;
  const m = Math.min(d0, d1, d2, d3);
  if (m === d0) return { x: 0, y };
  if (m === d1) return { x: 1, y };
  if (m === d2) return { x, y: 0 };
  return { x, y: 1 };
}

/** 마지막 세그먼트의 두 끝에 해당하는 스팟 인덱스(수구↔첫 스팟 구간이면 첫 스팟만) — 드래그·깜빡임 UI와 공유 */
export function isLastSegmentEndpointSpotIndex(prev: NanguPathPoint[], idx: number): boolean {
  const n = prev.length;
  if (n < 1) return false;
  if (idx === n - 1) return true;
  return n >= 2 && idx === n - 2;
}

export function moveCuePathSpotById(
  prev: NanguPathPoint[],
  id: string,
  norm: { x: number; y: number },
  snap: CuePathSnapFn,
  opts?: { forceMovableSpotId?: string | null }
): NanguPathPoint[] {
  const idx = prev.findIndex((q) => q.id === id);
  if (idx < 0) return prev;
  const n = prev.length;
  const forceId = opts?.forceMovableSpotId ?? null;
  /** 기본: 마지막 스팟만 이동. 사용자가 다른 스팟을 활성화하면 해당 id만 추가 이동 허용 */
  const canMove = idx === n - 1 || (forceId != null && prev[idx]!.id === forceId);
  if (!canMove) {
    return prev;
  }
  const snapCtx = (): CuePathSnapContext => ({
    firstFromCue: idx === 0,
    allowObjectBallSnap: allowObjectBallSnapAtPathIndex(prev, idx),
    approachNorm: approachNormForPathIndex(prev, idx),
  });
  return prev.map((p) => {
    if (p.id !== id) return p;
    if (p.type === "end") {
      const s = snap(norm.x, norm.y, snapCtx());
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      if (s.type === "ball" && allowObjectBallSnapAtPathIndex(prev, idx)) {
        return { ...p, x: s.x, y: s.y, type: "ball" };
      }
      const c = clampEndSpotPosition(norm.x, norm.y);
      return { ...p, x: c.x, y: c.y };
    }
    if (p.type === "ball") {
      const s = snap(norm.x, norm.y, snapCtx());
      if (s.type === "ball") {
        return { ...p, x: s.x, y: s.y, type: "ball" };
      }
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      const c = clampEndSpotPosition(norm.x, norm.y);
      return { ...p, x: c.x, y: c.y, type: "end" };
    }
    if (p.type === "cushion") {
      const isLastSpot = idx === prev.length - 1;
      const s = snap(norm.x, norm.y, snapCtx());
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      if (s.type === "ball" && allowObjectBallSnapAtPathIndex(prev, idx)) {
        return { ...p, x: s.x, y: s.y, type: "ball" };
      }
      /** 마지막 스팟만: 쿠션 → 플레이필드 안쪽(스냅 free)은 end로 — 그 외에는 기존처럼 가장 가까운 레일로만 이동 */
      if (s.type === "free" && isLastSpot) {
        const c = clampEndSpotPosition(norm.x, norm.y);
        return { ...p, x: c.x, y: c.y, type: "end" };
      }
      const rail = projectToNearestRail(norm.x, norm.y);
      const s2 = snap(rail.x, rail.y, snapCtx());
      if (s2.type === "cushion") {
        return { ...p, x: s2.x, y: s2.y, type: "cushion" };
      }
      if (s2.type === "ball" && allowObjectBallSnapAtPathIndex(prev, idx)) {
        return { ...p, x: s2.x, y: s2.y, type: "ball" };
      }
      return { ...p, x: s2.x, y: s2.y, type: "cushion" };
    }
    const s = snap(norm.x, norm.y, snapCtx());
    if (s.type === "cushion") {
      return { ...p, x: s.x, y: s.y, type: "cushion" };
    }
    if (s.type === "ball" && allowObjectBallSnapAtPathIndex(prev, idx)) {
      return { ...p, x: s.x, y: s.y, type: "ball" };
    }
    return { ...p, x: norm.x, y: norm.y };
  });
}
