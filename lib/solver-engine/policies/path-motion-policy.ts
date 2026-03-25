import type { NanguSolutionData } from "@/lib/nangu-types";
import type { MoveDistanceParams } from "@/lib/path-motion-distance";

export function buildMoveParamsFromSolution(
  data: Pick<NanguSolutionData, "isBankShot" | "thicknessOffsetX" | "ballSpeed" | "speedLevel" | "speed">,
  cushionCount: number
): MoveDistanceParams {
  return {
    ballSpeed: data.ballSpeed,
    speedLevel: data.speedLevel,
    speed: data.speed,
    cushionCount,
    isBankShot: data.isBankShot,
    thicknessOffsetX: data.thicknessOffsetX,
  };
}
