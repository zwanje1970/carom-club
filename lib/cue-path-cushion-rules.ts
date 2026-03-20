/**
 * 수구 진행 경로 쿠션 규칙 (2단계)
 * - 쿠션 3회 전: 레일(쿠션) 위 스팟만 추가·삽입 가능 (자유 위치 불가)
 * - 쿠션 3회 이후: 마지막에 end 타입 1개 — 플레이필드 내부 아무 곳, 화살표 표시
 * - cushion / end 스팟은 드래그로 이동 (쿠션은 레일에 스냅, end는 클램프만)
 */
import type { NanguPathPoint } from "@/lib/nangu-types";

export function countCushionSpots(points: NanguPathPoint[]): number {
  return points.filter((p) => p.type === "cushion").length;
}

export function hasEndSpot(points: NanguPathPoint[]): boolean {
  return points.some((p) => p.type === "end");
}

/** 쿠션이 3 미만이면 end 스팟 제거 */
export function stripInvalidEndSpots(points: NanguPathPoint[]): NanguPathPoint[] {
  if (countCushionSpots(points) >= 3) return points;
  return points.filter((p) => p.type !== "end");
}

const END_MARGIN = 0.02;

export function clampEndSpotPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.min(1 - END_MARGIN, Math.max(END_MARGIN, x)),
    y: Math.min(1 - END_MARGIN, Math.max(END_MARGIN, y)),
  };
}

/** 스냅 결과: 쿠션 레일 위만 cushion */
export type CushionSnapResult = { x: number; y: number; type: "cushion" | "free" };
export type CushionSnapFn = (x: number, y: number) => CushionSnapResult;

export type CuePathMutationResult =
  | { ok: true; points: NanguPathPoint[] }
  | { ok: false; message: string };

export function appendCuePathSpot(
  prev: NanguPathPoint[],
  norm: { x: number; y: number },
  snap: CushionSnapFn,
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "마지막 스팟이 이미 있습니다. 드래그로 위치를 조정하세요." };
  }
  const cushions = countCushionSpots(prev);
  const snapped = snap(norm.x, norm.y);
  if (cushions < 3) {
    if (snapped.type !== "cushion") {
      return {
        ok: false,
        message: "쿠션에 세 번 닿기 전에는 레일(쿠션) 위에만 스팟을 놓을 수 있습니다.",
      };
    }
    return {
      ok: true,
      points: [...prev, { id: newId(), x: snapped.x, y: snapped.y, type: "cushion" }],
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
  snap: CushionSnapFn,
  newId: () => string
): CuePathMutationResult {
  if (hasEndSpot(prev)) {
    return { ok: false, message: "마지막 스팟이 있으면 선분 삽입을 할 수 없습니다." };
  }
  const snapped = snap(norm.x, norm.y);
  const cushions = countCushionSpots(prev);
  if (cushions < 3) {
    if (snapped.type !== "cushion") {
      return {
        ok: false,
        message: "쿠션 세 번 전까지는 레일 위에만 스팟을 넣을 수 있습니다.",
      };
    }
    const next = [...prev];
    next.splice(segmentIndex, 0, { id: newId(), x: snapped.x, y: snapped.y, type: "cushion" });
    return { ok: true, points: next };
  }
  if (snapped.type !== "cushion") {
    return {
      ok: false,
      message:
        "세 쿠션 이후 중간 스팟은 레일 위만 가능합니다. 마지막 자유 스팟은 빈 곳을 한 번 더 탭하세요.",
    };
  }
  const next = [...prev];
  next.splice(segmentIndex, 0, { id: newId(), x: snapped.x, y: snapped.y, type: "cushion" });
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
  snap: CushionSnapFn
): NanguPathPoint[] {
  return prev.map((p) => {
    if (p.id !== id) return p;
    if (p.type === "end") {
      const c = clampEndSpotPosition(norm.x, norm.y);
      return { ...p, x: c.x, y: c.y };
    }
    if (p.type === "cushion") {
      const s = snap(norm.x, norm.y);
      if (s.type === "cushion") {
        return { ...p, x: s.x, y: s.y, type: "cushion" };
      }
      const rail = projectToNearestRail(norm.x, norm.y);
      const s2 = snap(rail.x, rail.y);
      return { ...p, x: s2.x, y: s2.y, type: "cushion" };
    }
    const s = snap(norm.x, norm.y);
    if (s.type === "cushion") {
      return { ...p, x: s.x, y: s.y, type: "cushion" };
    }
    return { ...p, x: norm.x, y: norm.y };
  });
}
