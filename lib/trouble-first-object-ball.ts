/**
 * 난구해법 제시 — 1목적구(ObjectBallColorKey) 결정
 *
 * **파생값만 사용 (state로 고정 저장하지 않음).** 호출 시점의 `pathPoints`·`objectPathPoints`만으로 계산한다.
 *
 * 규칙:
 * - 수구를 제외한 두 공 중, **공 표면에 찍힌 스팟(`type === "ball"`)**이 **경로 순서상 가장 먼저** 나온 공이 1목적구다.
 * - 수구 경로(`pathPoints`)를 앞에서부터 스캔한 뒤, 없으면 1목 경로(`objectPathPoints`)를 앞에서부터 스캔한다.
 *
 * **진행 순서와의 일치:** 이 앱에서 `pathPoints`는 수구 궤적을 **출발 순서대로** 이은 폴리라인이고,
 * `objectPathPoints`는 첫 목적구 충돌 이후 **이어지는 구간**만 담는다. 실제 타구는 항상 수구 경로 구간을
 * 끝까지(충돌점까지) 거친 뒤 1목 경로로 이어지므로, “먼저 찍힌 공 스팟”을 **수구 배열 전부 → 1목 배열 전부**
 * 순으로 보는 것이 **당구 진행 순서**와 맞는다. (단일 배열 우선순위 버그가 아니라, 두 레그의 시간 순서를
 * 데이터 모델이 이미 분리해 둔 것에 대응한다.)
 * - 광선 기하학만으로 충돌이 나도 **스팟이 없으면 1목 아님** → `null`.
 * - 스팟 좌표가 어느 비수구 공에 대응하는지는 플레이필드 px 거리(탭 반경 이내)로 판별한다.
 * - 유효한 공 스팟이 하나도 없으면 항상 `null`.
 */

import {
  distanceNormPointsInPlayfieldPx,
  getSolutionPathBallTapRadiusPx,
  type PlayfieldRect,
} from "@/lib/billiard-table-constants";
import {
  getNonCueBallNorms,
  type NanguBallPlacement,
  type NanguPathPoint,
  type ObjectBallColorKey,
} from "@/lib/nangu-types";

/** `type === "ball"` 스팟이 어느 비수구 공에 붙었는지 — 탭 반경 이내만 유효 */
function objectBallKeyForBallSpot(
  p: NanguPathPoint,
  placement: NanguBallPlacement,
  rect: PlayfieldRect
): ObjectBallColorKey | null {
  if (p.type !== "ball") return null;
  const nonCue = getNonCueBallNorms(placement);
  if (nonCue.length === 0) return null;
  const tapR = getSolutionPathBallTapRadiusPx(rect);
  let best: { key: ObjectBallColorKey; d: number } | null = null;
  for (const b of nonCue) {
    const d = distanceNormPointsInPlayfieldPx({ x: p.x, y: p.y }, { x: b.x, y: b.y }, rect);
    if (d <= tapR && (!best || d < best.d)) {
      best = { key: b.key, d };
    }
  }
  return best?.key ?? null;
}

/**
 * 현재 수구 경로·1목 경로에 실제로 찍힌 공 스팟만으로 1목적구 키를 반환.
 * 스팟이 없으면 `null` (과거 광선 hit·가까운 공 폴백 없음).
 */
export function resolveTroubleFirstObjectBallKey(params: {
  placement: NanguBallPlacement;
  cuePos: { x: number; y: number };
  pathPoints: NanguPathPoint[];
  objectPathPoints: NanguPathPoint[];
  rect: PlayfieldRect;
}): ObjectBallColorKey | null {
  const { placement, pathPoints, objectPathPoints, rect } = params;

  for (const p of pathPoints) {
    if (p.type !== "ball") continue;
    const k = objectBallKeyForBallSpot(p, placement, rect);
    if (k != null) return k;
  }

  for (const p of objectPathPoints) {
    if (p.type !== "ball") continue;
    const k = objectBallKeyForBallSpot(p, placement, rect);
    if (k != null) return k;
  }

  return null;
}
