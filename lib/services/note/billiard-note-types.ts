export type BilliardNoteWriteInput = {
  title?: string | null;
  noteDate?: string | null;
  redBall?: { x: number; y: number };
  yellowBall?: { x: number; y: number };
  whiteBall?: { x: number; y: number };
  cueBall?: string;
  memo?: string | null;
  imageUrl?: string | null;
  visibility?: string;
};

export type BilliardNoteListParams = {
  mine: boolean;
  visibility: string | null;
  sessionUserId: string;
};
