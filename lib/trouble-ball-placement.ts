import type { NanguBallPlacement } from "@/lib/nangu-types";

/** TroubleShotPost / API 응답용 — JSON 파싱 실패 시 null */
export function parseTroubleBallPlacementJson(
  raw: string | null | undefined
): NanguBallPlacement | null {
  if (raw == null || !String(raw).trim()) return null;
  try {
    const v = JSON.parse(raw) as NanguBallPlacement;
    if (
      v &&
      typeof v === "object" &&
      v.redBall &&
      v.yellowBall &&
      v.whiteBall &&
      (v.cueBall === "white" || v.cueBall === "yellow")
    ) {
      return v;
    }
    return null;
  } catch {
    return null;
  }
}
