export type TroubleFromNoteRequest = {
  noteId: string;
  title?: string;
  content?: string;
  imageUrl?: string | null;
  forceNew?: boolean;
};

export function parseTroubleFromNoteBody(json: unknown): TroubleFromNoteRequest | null {
  if (!json || typeof json !== "object") return null;
  return json as TroubleFromNoteRequest;
}

export function validateTroubleFromNote(body: TroubleFromNoteRequest): { ok: true; noteId: string } | { ok: false; error: string } {
  const noteId = (body.noteId ?? "").trim();
  if (!noteId) return { ok: false, error: "노트 ID가 필요합니다." };
  return { ok: true, noteId };
}
