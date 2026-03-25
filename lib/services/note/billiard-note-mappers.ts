import { normalizeCueBallType } from "@/lib/billiard-table-constants";
import type { BilliardNoteWriteInput } from "@/lib/services/note/billiard-note-types";

export function mapVisibility(v: string | undefined): "community" | "private" {
  return v === "community" ? "community" : "private";
}

export function mapCreateData(
  authorId: string,
  body: BilliardNoteWriteInput,
  balls: {
    redBall: { x: number; y: number };
    yellowBall: { x: number; y: number };
    whiteBall: { x: number; y: number };
  }
) {
  return {
    authorId,
    title: body.title?.trim() || null,
    noteDate: body.noteDate ? new Date(body.noteDate) : null,
    redBallX: balls.redBall.x,
    redBallY: balls.redBall.y,
    yellowBallX: balls.yellowBall.x,
    yellowBallY: balls.yellowBall.y,
    whiteBallX: balls.whiteBall.x,
    whiteBallY: balls.whiteBall.y,
    cueBall: normalizeCueBallType(body.cueBall),
    memo: body.memo?.trim() || null,
    imageUrl: body.imageUrl?.trim() || null,
    visibility: mapVisibility(body.visibility),
  };
}

export function mapPatchData(body: BilliardNoteWriteInput): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title?.trim() || null;
  if (body.noteDate !== undefined) data.noteDate = body.noteDate ? new Date(body.noteDate) : null;
  if (body.redBall != null) {
    data.redBallX = body.redBall.x;
    data.redBallY = body.redBall.y;
  }
  if (body.yellowBall != null) {
    data.yellowBallX = body.yellowBall.x;
    data.yellowBallY = body.yellowBall.y;
  }
  if (body.whiteBall != null) {
    data.whiteBallX = body.whiteBall.x;
    data.whiteBallY = body.whiteBall.y;
  }
  if (body.cueBall != null) {
    data.cueBall = normalizeCueBallType(body.cueBall);
  }
  if (body.memo !== undefined) data.memo = body.memo?.trim() || null;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl?.trim() || null;
  if (body.visibility != null) data.visibility = mapVisibility(body.visibility);
  return data;
}
