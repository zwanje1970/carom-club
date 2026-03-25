import type { BilliardNoteWriteInput } from "@/lib/services/note/billiard-note-types";

export function parseBilliardNoteWriteBody(json: unknown): BilliardNoteWriteInput | null {
  if (!json || typeof json !== "object") return null;
  return json as BilliardNoteWriteInput;
}

export function validateBallPlacementForCreate(body: BilliardNoteWriteInput): {
  ok: true;
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
} | { ok: false; error: string } {
  const redBall = body.redBall;
  const yellowBall = body.yellowBall;
  const whiteBall = body.whiteBall;
  if (
    !redBall || typeof redBall.x !== "number" || typeof redBall.y !== "number" ||
    !yellowBall || typeof yellowBall.x !== "number" || typeof yellowBall.y !== "number" ||
    !whiteBall || typeof whiteBall.x !== "number" || typeof whiteBall.y !== "number"
  ) {
    return { ok: false, error: "공 배치 정보(redBall, yellowBall, whiteBall)가 필요합니다." };
  }
  return { ok: true, redBall, yellowBall, whiteBall };
}
