import type {
  LabeledBallNorm,
  NanguBallPlacement,
  NanguSourceLayout,
} from "@/lib/types/shared-types";

/**
 * 게시글 `ballPlacementJson` 기준: 수구·1목(흰/노랑)·빨간 공 좌표.
 * 해법 dataJson과 별개 — 해법 작성 시 사용하는 당구대 공배치(문제와 동일 원본).
 */
export function problemViewerBallsFromPlacement(placement: NanguBallPlacement) {
  const cueBall = placement.cueBall === "white" ? placement.whiteBall : placement.yellowBall;
  const objectBall1 = placement.cueBall === "white" ? placement.yellowBall : placement.whiteBall;
  const objectBall2 = placement.redBall;
  return { cueBall, objectBall1, objectBall2, cueBallColor: placement.cueBall } as const;
}

/** 수구가 아닌 두 공(1목 후보) — 경로 스냅·충돌 광선의 먼저 맞는 공 판별에 사용 */
export function getNonCueBallNorms(placement: NanguBallPlacement): LabeledBallNorm[] {
  const { redBall, yellowBall, whiteBall, cueBall } = placement;
  if (cueBall === "white") {
    return [
      { key: "red", x: redBall.x, y: redBall.y },
      { key: "yellow", x: yellowBall.x, y: yellowBall.y },
    ];
  }
  return [
    { key: "red", x: redBall.x, y: redBall.y },
    { key: "white", x: whiteBall.x, y: whiteBall.y },
  ];
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
