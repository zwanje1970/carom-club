/**
 * 경로 스팟 표시·재생 폴리라인 공통 — 원 크기가 공과 같을 때:
 * - 원이 레일 밖으로 나가지 않도록 {@link clampBallToPlayfield}
 * - 스팟 원이 목적구(비수구) 원 내부로 침범하지 않도록 중심 간 거리 ≥ 2×공반지름(픽셀)
 * - **rect**는 저장 좌표와 동일한 **landscape** 플레이필드 rect(가로=긴 변)여야 함.
 *
 * 첫 수구 스팟이 맞는 1목 후보(`cueFirstSpotStruckBallNorm`)가 있으면:
 * 그 공과는 외접(중심거리=2R)만 강제(저장 좌표→목적구 중심 방향으로 투영), **나머지** 목적구만 겹침 방지 clamp.
 * 스냅 시 위치는 `spotCenterOnObjectBallExternalTangencyFromTap`(탭 방향·1목·2목 등 모든 비수구 관통 방지)으로 잡힘.
 * (두 목적구에 동시에 clamp하면 첫 스팟이 1목에서 떨어져 보이는 문제가 생길 수 있음.)
 */
import {
  clampBallToPlayfield,
  getBallRadius,
  getPlayfieldLongSide,
  normalizedToPixel,
  pixelToNormalized,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import type { NanguPathPoint } from "@/lib/nangu-types";

export type SpotDrawOptions = {
  /**
   * 목적구(비수구) 중심들 — 스팟 원(반지름=공)이 해당 공의 원과 겹치지 않게 바깥으로 보정.
   * 미전달 시 플레이필드 clamp만 적용.
   */
  objectBallNorms?: readonly { x: number; y: number }[];
  /**
   * 첫 수구 스팟이 맞는 1목 후보 공 **중심** — 전달 시 이 공과 외접만 맞춘 뒤, 다른 목적구만 `clampSpotCenterAwayFromObjectBalls`.
   */
  cueFirstSpotStruckBallNorm?: { x: number; y: number } | null;
};

function ballCentersCloseInPx(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: PlayfieldRect,
  epsPx = 1.5
): boolean {
  const { px: ax, py: ay } = normalizedToPixel(a.x, a.y, rect);
  const { px: bx, py: by } = normalizedToPixel(b.x, b.y, rect);
  return Math.hypot(ax - bx, ay - by) <= epsPx;
}

/** 스팟 중심을 (struck) 목적구와 반지름이 같을 때 외접이 되도록, 중심거리=2R로 맞춤. */
function forceExternalTangencyToBall(
  nx: number,
  ny: number,
  ballCenterNorm: { x: number; y: number },
  rect: PlayfieldRect
): { x: number; y: number } {
  const O = normalizedToPixel(ballCenterNorm.x, ballCenterNorm.y, rect);
  const P = normalizedToPixel(nx, ny, rect);
  let dx = P.px - O.px;
  let dy = P.py - O.py;
  let len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    dx = 1;
    dy = 0;
    len = 1;
  }
  const longSide = getPlayfieldLongSide(rect);
  const ballR = getBallRadius(longSide);
  const distPx = 2 * ballR;
  const sx = O.px + (dx / len) * distPx;
  const sy = O.py + (dy / len) * distPx;
  return pixelToNormalized(sx, sy, rect);
}

/**
 * 스팟 중심(정규화)을 목적구 원 밖으로 밀어냄. 스팟·공 반지름이 동일할 때 외접 이상 유지.
 */
export function clampSpotCenterAwayFromObjectBalls(
  x: number,
  y: number,
  rect: PlayfieldRect,
  objectBallNorms: readonly { x: number; y: number }[]
): { x: number; y: number } {
  if (objectBallNorms.length === 0) return { x, y };

  const longSide = getPlayfieldLongSide(rect);
  const ballR = getBallRadius(longSide);
  const minCenterDistPx = 2 * ballR;

  let nx = x;
  let ny = y;

  for (let iter = 0; iter < 24; iter++) {
    let { px: sx, py: sy } = normalizedToPixel(nx, ny, rect);
    let pushed = false;

    for (const ob of objectBallNorms) {
      const { px: ox, py: oy } = normalizedToPixel(ob.x, ob.y, rect);
      const dx = sx - ox;
      const dy = sy - oy;
      const d = Math.hypot(dx, dy);
      if (d >= minCenterDistPx - 1e-4) continue;
      pushed = true;
      if (d < 1e-9) {
        sx = ox + minCenterDistPx;
        sy = oy;
      } else {
        const s = minCenterDistPx / d;
        sx = ox + dx * s;
        sy = oy + dy * s;
      }
    }

    const { x: cx, y: cy } = pixelToNormalized(sx, sy, rect);
    const clamped = clampBallToPlayfield(cx, cy, rect);
    nx = clamped.x;
    ny = clamped.y;

    if (!pushed) break;
  }

  return { x: nx, y: ny };
}

export function spotCenterNormForDraw(
  p: NanguPathPoint,
  rect: PlayfieldRect,
  options?: SpotDrawOptions
): { x: number; y: number } {
  let n = clampBallToPlayfield(p.x, p.y, rect);
  const obs = options?.objectBallNorms;
  if (!obs?.length) return n;

  const struck = options?.cueFirstSpotStruckBallNorm;
  if (struck) {
    n = forceExternalTangencyToBall(n.x, n.y, struck, rect);
    const others = obs.filter((o) => !ballCentersCloseInPx(o, struck, rect));
    if (!others.length) return clampBallToPlayfield(n.x, n.y, rect);
    return clampSpotCenterAwayFromObjectBalls(n.x, n.y, rect, others);
  }

  return clampSpotCenterAwayFromObjectBalls(n.x, n.y, rect, obs);
}
