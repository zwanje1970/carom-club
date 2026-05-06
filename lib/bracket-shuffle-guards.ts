/**
 * 대진표 라운드 셔플 가능 여부(클라이언트·서버 공통, 순수 함수)
 */

export type ShuffleGuardPlayer = {
  userId: string;
  name: string;
};

export type ShuffleGuardRound = {
  roundNumber: number;
  matches: Array<{ player1: ShuffleGuardPlayer; player2: ShuffleGuardPlayer }>;
};

/** 빈 슬롯·대기 슬롯은 값 없음. 이름이 비어 있어도 BYE 등은 값 있음으로 간주 */
export function slotHasValueForShuffle(p: ShuffleGuardPlayer): boolean {
  const uid = typeof p.userId === "string" ? p.userId.trim() : "";
  const nm = typeof p.name === "string" ? p.name.trim() : "";
  if (nm.length > 0) return true;
  if (uid.startsWith("__BYE__")) return true;
  if (!uid || uid.startsWith("__FIN_SLOT__") || uid.startsWith("__FIN_WAIT__")) return false;
  if (uid.startsWith("__TBD__")) return false;
  return uid.length > 0;
}

export function sliceRoundAllSlotsFilled(rounds: ShuffleGuardRound[], roundNumber: number): boolean {
  const cr = rounds.find((r) => r.roundNumber === roundNumber);
  if (!cr?.matches.length) return false;
  for (const m of cr.matches) {
    if (!slotHasValueForShuffle(m.player1) || !slotHasValueForShuffle(m.player2)) return false;
  }
  return true;
}

/** 다음 라운드에 참가자·BYE 등 값이 하나라도 있으면 true */
export function sliceNextRoundHasAnySlotValue(rounds: ShuffleGuardRound[], roundNumber: number): boolean {
  const nr = rounds.find((r) => r.roundNumber === roundNumber + 1);
  if (!nr?.matches.length) return false;
  for (const m of nr.matches) {
    if (slotHasValueForShuffle(m.player1) || slotHasValueForShuffle(m.player2)) return true;
  }
  return false;
}

/** null이면 셔플 가능 */
export function getShuffleRoundBlockedReason(rounds: ShuffleGuardRound[], roundNumber: number): string | null {
  const cr = rounds.find((r) => r.roundNumber === roundNumber);
  if (!cr?.matches.length) return "해당 라운드가 없습니다.";
  if (!sliceRoundAllSlotsFilled(rounds, roundNumber)) return "빈 슬롯이 있어 셔플할 수 없습니다.";
  if (sliceNextRoundHasAnySlotValue(rounds, roundNumber)) return "다음 라운드에 진출자가 있어 셔플할 수 없습니다.";
  return null;
}
