import type {
  LabeledBallNorm,
  NanguBallPlacement,
  NanguSourceLayout,
  ObjectBallColorKey,
} from "@/lib/types/shared-types";

/**
 * `getNonCueBallNorms` 정렬용 — red를 배열 선두에 두지 않음(표시·순회만).
 */
const NON_CUE_KEY_SORT_ORDER: ObjectBallColorKey[] = ["white", "yellow", "red"];

function compareNonCueKeysForSort(a: ObjectBallColorKey, b: ObjectBallColorKey): number {
  return NON_CUE_KEY_SORT_ORDER.indexOf(a) - NON_CUE_KEY_SORT_ORDER.indexOf(b);
}

/** placement에서 해당 색 공의 정규화 좌표(키 조회 — 배열 순서 무관). */
export function ballLabeledNormForKey(
  placement: NanguBallPlacement,
  key: ObjectBallColorKey
): LabeledBallNorm {
  switch (key) {
    case "red":
      return { key: "red", x: placement.redBall.x, y: placement.redBall.y };
    case "yellow":
      return { key: "yellow", x: placement.yellowBall.x, y: placement.yellowBall.y };
    case "white":
      return { key: "white", x: placement.whiteBall.x, y: placement.whiteBall.y };
  }
}

/**
 * 전체 공 중 수구·`firstObjectKey`를 제외한 비수구 **정확히 1개**의 키.
 * 비정상(0개 또는 2개 남음)이면 `null`.
 */
export function getSecondObjectBallKeyExclusive(
  placement: NanguBallPlacement,
  firstObjectKey: ObjectBallColorKey
): ObjectBallColorKey | null {
  const cue = placement.cueBall;
  let only: ObjectBallColorKey | null = null;
  for (const k of ["red", "yellow", "white"] as const) {
    if (k === cue || k === firstObjectKey) continue;
    if (only != null) return null;
    only = k;
  }
  return only;
}

/**
 * 재생/해법에서 결정된 1·2목 키로 뷰어용 좌표를 낸다. (색 고정 매핑 없음)
 */
export function problemViewerBallsFromPlacement(
  placement: NanguBallPlacement,
  resolved: {
    reflectionObjectBall: ObjectBallColorKey;
    secondReflectionObjectBall: ObjectBallColorKey;
  }
) {
  const cueBall = placement.cueBall === "white" ? placement.whiteBall : placement.yellowBall;
  const firstContact = ballLabeledNormForKey(placement, resolved.reflectionObjectBall);
  const secondContact = ballLabeledNormForKey(placement, resolved.secondReflectionObjectBall);
  return {
    cueBall,
    objectBallFirstContact: { x: firstContact.x, y: firstContact.y },
    objectBallSecondContact: { x: secondContact.x, y: secondContact.y },
    cueBallColor: placement.cueBall,
  } as const;
}

/**
 * 수구가 아닌 두 공 — **정렬만** 통일(white→yellow→red). 호출부는 인덱스/첫 요소에 의미를 두지 말 것.
 */
export function getNonCueBallNorms(placement: NanguBallPlacement): LabeledBallNorm[] {
  const nonCueKeys = (["red", "yellow", "white"] as const).filter((k) => k !== placement.cueBall);
  const norms = nonCueKeys.map((k) => ballLabeledNormForKey(placement, k));
  norms.sort((a, b) => compareNonCueKeysForSort(a.key, b.key));
  return norms;
}

/** NanguBallPlacement → NanguSourceLayout 변환 */
export function ballPlacementToSourceLayout(
  title: string,
  description: string,
  placement: NanguBallPlacement
): NanguSourceLayout {
  const { redBall, yellowBall, whiteBall, cueBall } = placement;
  const balls = [
    { id: "red", color: "red" as const, ...redBall, isCue: false },
    { id: "yellow", color: "yellow" as const, ...yellowBall, isCue: cueBall === "yellow" },
    { id: "white", color: "white" as const, ...whiteBall, isCue: cueBall === "white" },
  ];
  return { title, description, balls };
}
