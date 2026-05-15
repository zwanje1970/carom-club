export type QuickResultDetailDraft = {
  firstAttackUserId: string;
  scorePlayer1: string;
  scorePlayer2: string;
  endInning: string;
  highRunPlayer1: string;
  highRunPlayer2: string;
  winnerUserId: string;
};

export function quickResultDetailDraftStorageKey(tournamentId: string, matchId: string): string {
  return `v3:bracket:quick-detail-draft:${tournamentId.trim()}:${matchId.trim()}`;
}

export function readQuickResultDetailDraft(
  tournamentId: string,
  matchId: string,
): QuickResultDetailDraft | null {
  if (!tournamentId.trim() || !matchId.trim() || typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(quickResultDetailDraftStorageKey(tournamentId, matchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<QuickResultDetailDraft>;
    if (typeof parsed !== "object" || parsed == null) return null;
    return {
      firstAttackUserId: typeof parsed.firstAttackUserId === "string" ? parsed.firstAttackUserId : "",
      scorePlayer1: typeof parsed.scorePlayer1 === "string" ? parsed.scorePlayer1 : "",
      scorePlayer2: typeof parsed.scorePlayer2 === "string" ? parsed.scorePlayer2 : "",
      endInning: typeof parsed.endInning === "string" ? parsed.endInning : "",
      highRunPlayer1: typeof parsed.highRunPlayer1 === "string" ? parsed.highRunPlayer1 : "",
      highRunPlayer2: typeof parsed.highRunPlayer2 === "string" ? parsed.highRunPlayer2 : "",
      winnerUserId: typeof parsed.winnerUserId === "string" ? parsed.winnerUserId : "",
    };
  } catch {
    return null;
  }
}

export function writeQuickResultDetailDraft(
  tournamentId: string,
  matchId: string,
  draft: QuickResultDetailDraft,
): void {
  if (!tournamentId.trim() || !matchId.trim() || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(quickResultDetailDraftStorageKey(tournamentId, matchId), JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function clearQuickResultDetailDraft(tournamentId: string, matchId: string): void {
  if (!tournamentId.trim() || !matchId.trim() || typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(quickResultDetailDraftStorageKey(tournamentId, matchId));
  } catch {
    /* ignore */
  }
}
