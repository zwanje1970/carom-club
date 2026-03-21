/**
 * 수구 진행 경로 규칙
 * - 경로 **선분**은 항상 수구 위치에서 첫 스팟으로 시작(렌더: `buildCuePathSegments`).
 * - **수구에서 이어지는 첫 스팟**은 **1목 후보 공 중심**(수구 제외 2구 중 탭에 가까운 쪽) 또는 **플레이필드·쿠션(레일) 안쪽 테두리**에만 연결.
 * - **쿠션필드·프레임** 탭: 직전 점→탭 방향 반직선이 먼저 만나는 **쿠션 라인(플레이필드 경계)** 또는 **수구가 아닌 공의 원 둘레**에 스팟(`appendCuePathSpotWithAim` / `lib/cue-path-ray-resolve`).
 * - 그 다음부터: 쿠션 체인은 테두리끼리만 이어짐. 테두리가 아니면 **end**(화살표, 다음 스팟 없음).
 * - 선분 삽입: 첫 구간(수구~첫 스팟 사이)에 넣을 때만 1목/테두리 허용, 그 외는 테두리만.
 * - cushion / ball / end 스팟은 드래그로 이동 (마지막 쿠션 → 안쪽 end, end → 테두리 쿠션 스냅 시 cushion)
 */
import type { NanguBallPlacement, NanguPathPoint } from "@/lib/nangu-types";
import {
  DEFAULT_TABLE_HEIGHT,
  DEFAULT_TABLE_WIDTH,
  distanceNormPointsInPlayfieldPx,
  getPlayfieldRect,
  getSolutionPathBallTapRadiusPx,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import { resolveCuePathRayHitLandscape } from "@/lib/cue-path-ray-resolve";
import { ballCircumferenceNormFacingApproach } from "@/lib/solution-path-geometry";

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

/** `cueNorm`이 있으면 ball 스냅을 공 **원주**(수구 방향)에 둠 */
export type CuePathSnapContext = { firstFromCue: boolean; cueNorm?: { x: number; y: number } };

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
 * - `firstFromCue`: 수구에서 바로 이어지는 스팟(첫 점 또는 그 앞에 삽입)일 때만 **1목 후보 공**(수구 제외 2개) 스냅.
 */
export function snapCuePathTap(
  x: number,
  y: number,
  firstObjectCandidates: { x: number; y: number }[] | null,
  ctx: CuePathSnapContext
): CuePathSnapResult {
  if (ctx.firstFromCue && firstObjectCandidates && firstObjectCandidates.length > 0) {
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
      if (ctx.cueNorm) {
        const surf = ballCircumferenceNormFacingApproach(best, ctx.cueNorm, rect);
        return { type: "ball", x: surf.x, y: surf.y };
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
    const surf = ballCircumferenceNormFacingApproach(best, fromNorm, rect);
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

/** 반직선으로 구한 쿠션/공 둘레 점을 기존 규칙에 맞게 추가 */
function appendResolvedCueSpot(
  prev: NanguPathPoint[],
  resolved: { x: number; y: number; type: "cushion" | "ball" },
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "마지막 스팟이 이미 있습니다. 드래그로 위치를 조정하세요." };
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
  return { ok: false, message: "마지막 스팟이 이미 있습니다." };
}

function allowNonCueBallCircleForCueAppend(prev: NanguPathPoint[]): boolean {
  return prev.length === 0;
}

function allowNonCueBallCircleForCueInsert(prev: NanguPathPoint[], segmentIndex: number): boolean {
  return segmentIndex === 0;
}

export function appendCuePathSpotWithAim(
  prev: NanguPathPoint[],
  aim: PathPointerAim,
  snap: CuePathSnapFn,
  newId: () => string,
  rayCtx: CuePathRayAppendContext
): CuePathMutationResult {
  if (aim.kind === "playfield") {
    return appendCuePathSpot(prev, aim.norm, snap, newId);
  }
  const last = lastPathSpot(prev);
  const fromLandscape = last ? { x: last.x, y: last.y } : rayCtx.cueLandscape;
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
  const firstFromCue = segmentIndex === 0;
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
    allowNonCueBallCircle: allowNonCueBallCircleForCueInsert(prev, segmentIndex),
  });
  if (!hit) {
    return {
      ok: false,
      message: "쿠션·프레임 방향으로 삽입할 위치를 찾지 못했습니다.",
    };
  }
  const okSpot = hit.type === "cushion" || (firstFromCue && hit.type === "ball");
  if (!okSpot) {
    return {
      ok: false,
      message: firstFromCue
        ? "수구 직후 구간만 목적구 둘레에 스팟을 넣을 수 있습니다. 그 외 중간 구간은 쿠션 라인만 가능합니다."
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
    return { ok: false, message: "마지막 스팟이 이미 있습니다. 드래그로 위치를 조정하세요." };
  }
  const last = lastPathSpot(prev);
  const snapped = snap(norm.x, norm.y, { firstFromCue: !last });

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

  /** 쿠션 체인 이후: 테두리만 다음 쿠션 (1목 스냅 비활성) */
  const chainSnap = snap(norm.x, norm.y, { firstFromCue: false });

  /** 이어 붙이기: 직전이 쿠션일 때만 체인 — 레일이면 다음 쿠션, 아니면 end */
  if (last.type === "cushion") {
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

  /** ball 등 첫 스팟이 쿠션이 아닐 때: 쿠션만 이어 붙임, 아니면 끝 */
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
  const firstFromCue = segmentIndex === 0;
  const snapped = snap(norm.x, norm.y, { firstFromCue });
  const okSpot =
    snapped.type === "cushion" || (firstFromCue && snapped.type === "ball");
  if (!okSpot) {
    return {
      ok: false,
      message: firstFromCue
        ? "수구 직후 스팟은 1목 후보 공(수구 제외 2구) 또는 플레이필드·쿠션이 만나는 테두리 위에만 넣을 수 있습니다. 중간 구간은 테두리 위만 가능합니다."
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

export function moveCuePathSpotById(
  prev: NanguPathPoint[],
  id: string,
  norm: { x: number; y: number },
  snap: CuePathSnapFn
): NanguPathPoint[] {
  const idx = prev.findIndex((q) => q.id === id);
  const firstFromCue = idx === 0;
  return prev.map((p) => {
    if (p.id !== id) return p;
    if (p.type === "end") {
      const s = snap(norm.x, norm.y, { firstFromCue: idx === 0 });
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      if (s.type === "ball" && idx === 0) {
        return { ...p, x: s.x, y: s.y, type: "ball" };
      }
      const c = clampEndSpotPosition(norm.x, norm.y);
      return { ...p, x: c.x, y: c.y };
    }
    if (p.type === "ball") {
      const s = snap(norm.x, norm.y, { firstFromCue: true });
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
      const s = snap(norm.x, norm.y, { firstFromCue });
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      if (s.type === "ball" && firstFromCue) {
        return { ...p, x: s.x, y: s.y, type: "ball" };
      }
      /** 마지막 스팟만: 쿠션 → 플레이필드 안쪽(스냅 free)은 end로 — 그 외에는 기존처럼 가장 가까운 레일로만 이동 */
      if (s.type === "free" && isLastSpot) {
        const c = clampEndSpotPosition(norm.x, norm.y);
        return { ...p, x: c.x, y: c.y, type: "end" };
      }
      const rail = projectToNearestRail(norm.x, norm.y);
      const s2 = snap(rail.x, rail.y, { firstFromCue });
      if (s2.type === "cushion") {
        return { ...p, x: s2.x, y: s2.y, type: "cushion" };
      }
      if (s2.type === "ball" && firstFromCue) {
        return { ...p, x: s2.x, y: s2.y, type: "ball" };
      }
      return { ...p, x: s2.x, y: s2.y, type: "cushion" };
    }
    const s = snap(norm.x, norm.y, { firstFromCue });
    if (s.type === "cushion") {
      return { ...p, x: s.x, y: s.y, type: "cushion" };
    }
    if (s.type === "ball" && firstFromCue) {
      return { ...p, x: s.x, y: s.y, type: "ball" };
    }
    return { ...p, x: norm.x, y: norm.y };
  });
}
