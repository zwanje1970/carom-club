import type {
  LabeledBallNorm,
  NanguBallPlacement,
  NanguSourceLayout,
} from "@/lib/types/shared-types";

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
