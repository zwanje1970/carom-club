/**
 * 대진표 "보기" 전용 화면에서 인터랙티브 보드 동작을 서버와 동기화하기 위한 헬퍼.
 * (메인 bracket/page.tsx 의 저장 순서와 동일하게 유지)
 */

export type BracketRoundLike = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: Array<{
    id: string;
    player1: { userId: string; name: string };
    player2: { userId: string; name: string };
    winnerUserId: string | null;
    winnerName: string | null;
    status: "PENDING" | "COMPLETED";
  }>;
};

export type BracketLike = {
  id: string;
  rounds: BracketRoundLike[];
  bracketMode?: "single" | "multi_block";
  blocks?: Array<{ id: string; label?: string; rounds: BracketRoundLike[] }>;
  finalBlock?: { rounds: BracketRoundLike[] };
};

/** 클라이언트·서버 공통: 승자로 저장·전파 가능한 실참가자 userId */
export function isEligibleBracketWinnerUserId(userId: string): boolean {
  const w = typeof userId === "string" ? userId.trim() : "";
  if (!w || w === "__none" || w.startsWith("__TBD__")) return false;
  return true;
}

/** 상위 라운드 표시 라벨 전파 허용(표시용 예약 문자열 제외) */
export function isPropagatableBracketWinnerLabel(label: string): boolean {
  const t = typeof label === "string" ? label.trim() : "";
  if (!t) return false;
  if (t.toUpperCase() === "TBD") return false;
  if (t === "대상참가자") return false;
  if (t === "대기") return false;
  return true;
}

export function getSliceRoundsFromBracket(b: BracketLike, sliceKey: string | null): BracketRoundLike[] {
  if (b.bracketMode === "multi_block" && sliceKey) {
    if (sliceKey === "final") return b.finalBlock?.rounds ?? [];
    if (sliceKey.startsWith("block:")) {
      const bid = sliceKey.slice("block:".length);
      return b.blocks?.find((bl) => bl.id === bid)?.rounds ?? [];
    }
    return [];
  }
  return b.rounds;
}

export function findBracketMatchLocation(
  bracket: BracketLike,
  matchId: string,
): {
  round: BracketRoundLike;
  match: BracketRoundLike["matches"][number];
  sliceKey: string | null;
  sliceRounds: BracketRoundLike[];
} | null {
  const id = matchId.trim();
  if (!id) return null;
  if (bracket.bracketMode === "multi_block" && bracket.blocks?.length) {
    for (const block of bracket.blocks) {
      for (const round of block.rounds) {
        const match = round.matches.find((m) => m.id === id);
        if (match) return { round, match, sliceKey: `block:${block.id}`, sliceRounds: block.rounds };
      }
    }
    const finals = bracket.finalBlock?.rounds;
    if (finals) {
      for (const round of finals) {
        const match = round.matches.find((m) => m.id === id);
        if (match) return { round, match, sliceKey: "final", sliceRounds: finals };
      }
    }
    return null;
  }
  for (const round of bracket.rounds) {
    const match = round.matches.find((m) => m.id === id);
    if (match) return { round, match, sliceKey: null, sliceRounds: bracket.rounds };
  }
  return null;
}

export function hasDownstreamRoundsInSlice(sliceRounds: BracketRoundLike[], roundNumber: number): boolean {
  return sliceRounds.some((r) => r.roundNumber > roundNumber);
}

export type MutationFns = {
  patchMatchResult: (
    matchId: string,
    winnerUserId: string | null,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
  advanceRound: (
    roundNumber: number,
    sliceKey?: string | null,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
  resetAfter: (
    roundNumber: number,
    sliceKey?: string | null,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
  rebuildFromRound: (
    roundNumber: number,
    sliceKey?: string | null,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
  reassign: (
    roundNumber: number,
    operations: Array<
      | { type: "swap_within_match"; matchId: string }
      | {
          type: "swap_between_matches";
          matchAId: string;
          slotA: "player1" | "player2";
          matchBId: string;
          slotB: "player1" | "player2";
        }
    >,
    sliceKey?: string | null,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
  renamePlayer: (
    matchId: string,
    slot: "player1" | "player2",
    displayName: string,
  ) => Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }>;
};

export async function syncWinnerPick(params: {
  bracket: BracketLike;
  matchId: string;
  winnerUserId: string;
  roundNumber: number;
  mut: MutationFns;
  hasDownstream: (b: BracketLike, roundNumber: number, sliceKey: string | null) => boolean;
}): Promise<{ ok: true; bracket: BracketLike; message: string } | { ok: false; error: string }> {
  const loc = findBracketMatchLocation(params.bracket, params.matchId);
  if (!loc) return { ok: false, error: "대상 매치를 찾을 수 없습니다." };

  if (!isEligibleBracketWinnerUserId(params.winnerUserId)) {
    return { ok: false, error: "승자로 저장할 수 없는 참가자입니다." };
  }

  const { round: currentRound, match: currentMatch, sliceKey: winSliceKey, sliceRounds } = loc;
  const changingWinner =
    typeof currentMatch.winnerUserId === "string" &&
    currentMatch.winnerUserId.trim() !== "" &&
    currentMatch.winnerUserId !== params.winnerUserId;

  if (changingWinner) {
    const hasNextRound = sliceRounds.some((r) => r.roundNumber === currentRound.roundNumber + 1);
    if (hasNextRound) {
      if (!window.confirm("이전 라운드 승자를 변경하면 이후 라운드가 초기화됩니다. 계속 진행할까요?")) {
        return { ok: false, error: "취소되었습니다." };
      }
    } else if (!window.confirm("승자를 변경합니다. 계속 진행할까요?")) {
      return { ok: false, error: "취소되었습니다." };
    }
  }

  let workingBracket = params.bracket;

  if (changingWinner && params.hasDownstream(workingBracket, currentRound.roundNumber, winSliceKey)) {
    const resetResult = await params.mut.resetAfter(currentRound.roundNumber, winSliceKey);
    if (!resetResult.ok) return { ok: false, error: resetResult.error };
    workingBracket = resetResult.bracket;
  }

  const result = await params.mut.patchMatchResult(params.matchId, params.winnerUserId);
  if (!result.ok) return { ok: false, error: result.error };

  let nextBracket = result.bracket;
  if (changingWinner) {
    const rebuildResult = await params.mut.rebuildFromRound(currentRound.roundNumber, winSliceKey);
    if (!rebuildResult.ok) return { ok: false, error: rebuildResult.error };
    nextBracket = rebuildResult.bracket;
  }

  const sliceAfter = getSliceRoundsFromBracket(nextBracket, winSliceKey);
  const rr = sliceAfter.find((r) => r.roundNumber === params.roundNumber) ?? null;
  const shouldAdvance =
    rr !== null &&
    rr.status === "COMPLETED" &&
    !sliceAfter.some((r) => r.roundNumber === rr.roundNumber + 1);

  if (shouldAdvance && rr) {
    const advResult = await params.mut.advanceRound(rr.roundNumber, winSliceKey);
    if (advResult.ok) {
      nextBracket = advResult.bracket;
    } else {
      return { ok: true, bracket: nextBracket, message: advResult.error };
    }
  }

  return { ok: true, bracket: nextBracket, message: "" };
}

/** 진출 취소(승자 해제): PATCH winnerUserId null + 필요 시 reset/rebuild */
export async function syncClearMatchWinner(params: {
  bracket: BracketLike;
  matchId: string;
  mut: MutationFns;
  hasDownstream: (b: BracketLike, roundNumber: number, sliceKey: string | null) => boolean;
}): Promise<{ ok: true; bracket: BracketLike; message: string } | { ok: false; error: string }> {
  const loc = findBracketMatchLocation(params.bracket, params.matchId);
  if (!loc) return { ok: false, error: "대상 매치를 찾을 수 없습니다." };

  const { round: currentRound, match: currentMatch, sliceKey: winSliceKey } = loc;
  const hadWinner =
    typeof currentMatch.winnerUserId === "string" && currentMatch.winnerUserId.trim() !== "";

  if (!hadWinner) {
    return { ok: true, bracket: params.bracket, message: "" };
  }

  let workingBracket = params.bracket;
  if (params.hasDownstream(workingBracket, currentRound.roundNumber, winSliceKey)) {
    const resetResult = await params.mut.resetAfter(currentRound.roundNumber, winSliceKey);
    if (!resetResult.ok) return { ok: false, error: resetResult.error };
    workingBracket = resetResult.bracket;
  }

  const result = await params.mut.patchMatchResult(params.matchId, null);
  if (!result.ok) return { ok: false, error: result.error };

  let nextBracket = result.bracket;
  if (params.hasDownstream(params.bracket, currentRound.roundNumber, winSliceKey)) {
    const rebuildResult = await params.mut.rebuildFromRound(currentRound.roundNumber, winSliceKey);
    if (!rebuildResult.ok) return { ok: false, error: rebuildResult.error };
    nextBracket = rebuildResult.bracket;
  }

  return { ok: true, bracket: nextBracket, message: "" };
}

export function shuffleScopeForSlice(
  b: BracketLike,
  sliceKey: string | null,
): "final_only" | "qualifiers_only" | { blockId: string } {
  if (b.bracketMode !== "multi_block") return "qualifiers_only";
  if (sliceKey === "final") return "final_only";
  if (sliceKey?.startsWith("block:")) {
    return { blockId: sliceKey.slice("block:".length) };
  }
  return "qualifiers_only";
}

export async function syncSwapPlayers(params: {
  bracket: BracketLike;
  roundNumber: number;
  first: { matchId: string; slot: "player1" | "player2" };
  second: { matchId: string; slot: "player1" | "player2" };
  mut: MutationFns;
  hasDownstream: (b: BracketLike, roundNumber: number, sliceKey: string | null) => boolean;
}): Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }> {
  if (params.first.matchId === params.second.matchId && params.first.slot === params.second.slot) {
    return { ok: false, error: "동일 슬롯입니다." };
  }
  const loc = findBracketMatchLocation(params.bracket, params.first.matchId);
  const swapSlice = loc?.sliceKey ?? null;
  if (params.bracket.bracketMode === "multi_block" && swapSlice === null) {
    return { ok: false, error: "분할 대진표에서 매치 위치를 특정할 수 없습니다." };
  }

  let next = params.bracket;
  if (params.hasDownstream(next, params.roundNumber, swapSlice)) {
    const reset = await params.mut.resetAfter(params.roundNumber, swapSlice);
    if (!reset.ok) return { ok: false, error: reset.error };
    next = reset.bracket;
  }

  const swapped = await params.mut.reassign(params.roundNumber, [
    {
      type: "swap_between_matches",
      matchAId: params.first.matchId,
      slotA: params.first.slot,
      matchBId: params.second.matchId,
      slotB: params.second.slot,
    },
  ], swapSlice);
  if (!swapped.ok) return { ok: false, error: swapped.error };

  next = swapped.bracket;
  if (params.hasDownstream(params.bracket, params.roundNumber, swapSlice)) {
    const rebuilt = await params.mut.rebuildFromRound(params.roundNumber, swapSlice);
    if (!rebuilt.ok) return { ok: false, error: rebuilt.error };
    next = rebuilt.bracket;
  }
  return { ok: true, bracket: next };
}

export async function syncRenamePlayer(params: {
  bracket: BracketLike;
  roundNumber: number;
  matchId: string;
  slot: "player1" | "player2";
  displayName: string;
  mut: MutationFns;
  hasDownstream: (b: BracketLike, roundNumber: number, sliceKey: string | null) => boolean;
}): Promise<{ ok: true; bracket: BracketLike } | { ok: false; error: string }> {
  const nextName = params.displayName.trim();

  const loc = findBracketMatchLocation(params.bracket, params.matchId);
  const renameSlice = loc?.sliceKey ?? null;
  if (params.bracket.bracketMode === "multi_block" && renameSlice === null) {
    return { ok: false, error: "분할 대진표에서 매치 위치를 특정할 수 없습니다." };
  }

  const renamed = await params.mut.renamePlayer(params.matchId, params.slot, nextName);
  if (!renamed.ok) return { ok: false, error: renamed.error };
  return { ok: true, bracket: renamed.bracket };
}
